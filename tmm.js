__serverBase__ = "http://192.168.233.234/tmm/";
__prefix__ = "tmm_edit_";
__retry_period__ = 500;
let editor;
let last_timestamp = 0;
let rwkey = null;

let ai_table = new Map();

let popupWindow = window;

function callbackFromPane(w) {
    popupWindow = w;
    updateChildWindow();
}

function getWindow() {
    if(popupWindow && popupWindow.closed) {
        popupWindow = window;
    }
    return popupWindow;
}
function openPopup() {
    let w = window.open("edit_popup.html", "floatpane", "popup")
    let poll_window_exist = () => {
        if(getWindow() != window) {
            setTimeout(poll_window_exist, 500);
        }
    }
    setTimeout(poll_window_exist, 500);
}

function addVisitedPages() {
    let setting;
    try {
        setting = JSON.parse(localStorage.getItem(__prefix__ + "visitedPages"));
    } catch (exception) {
        console.log("localStorage parsing failed : ", exception);
    }
    if (!setting || setting == "" || typeof setting == "Array") {
        setting = {};
    }
    let d = { "rwkey" : rwkey};
    if(setting.hasOwnProperty(rwkey)) {
        d = setting[rwkey];
    }
    d["title"] = document.getElementById("title").value;
    setting[rwkey] = d;
    localStorage.setItem(__prefix__ + "visitedPages", JSON.stringify(setting));
    // console.log(setting);
}

function getNextAINum() {
    return 0;
}

function timeFormat () {
    let date = new Date();
    return (new Intl.DateTimeFormat("en", {year: "numeric", hour12: false}).format(date))
            + "/" + (new Intl.DateTimeFormat("en", {month: "2-digit", day: "2-digit"}).format(date))
            + " " + (new Intl.DateTimeFormat("en", {hour: "2-digit", minute: "2-digit", hour12: false}).format(date))
    ;
};
// I don't like ckedit being picky on how to control height..
function setSize() {
    let height = window.innerHeight;
    editor.editing.view.change( writer => {
        writer.setStyle( 'height', ""+(height-200) + "px", editor.editing.view.document.getRoot() );
    } );
}

function updateChildWindow() {
    let d = html_to_text.convert(editor.getData(), {wordwrap:9999999});
    if(getWindow() != window) {
        getWindow().msgpane.innerHTML = "<pre>" + d + "</pre>";
    }

    ai_table = new Map();
    let lines = d.split('\n');
    let date = timeFormat();

    function addAI(number, state, owner, comment) {
    }

    lines.forEach(ln => {
        let m = ln.match(/!!date\s*(.*)$/);
        if(m) {
            console.log("date", m[1]);
            date = m[1];
        }

        let m2 = ln.match(/!!ai\s*\(([^|]*)\|([^|]*)\|([^|]*)\)(.*)$/);
        if(m2) {
            console.log("ai", m2);
            addAI(m2[1], m2[2], m2[3], m2[4]);
        }

        m2 = ln.match(/!!ai\s*\(([^|]*)\|([^|]*)\)(.*)$/);
        if(m2) {
            console.log("ai", m2);
            addAI(m2[1], m2[2], "", m2[3]);
        }
        m2 = ln.match(/!!ai\s*\(([^|]*)\)(.*)$/);
        if(m2) {
            console.log("ai", m2);
            addAI(m2[1], "", "", m2[3]);
        }
    });
}

function createEditor() {

    ClassicEditor
        .create( document.querySelector('#editor'), {
            simpleUpload: {
                uploadUrl: "image_upload.php",
                withCredentials: false
            },
            autosave: {
                save(editor) {
                    updateChildWindow();
                    return new Promise(function(resolve, reject) {
                        let xhr = new XMLHttpRequest();
                        let data = editor.getData();
                        if(rwkey == null) {
                            initiateRWKey();
                            reject();
                        } else {
                            xhr.open('POST', __serverBase__ + "/p/w.php");
                            let data = new FormData();
                            data.append('k', rwkey);
                            let title = document.getElementById("title").value;
                            if(title == "") { title = "untitled"; }
                            data.append('title', title);
                            data.append('sync', 1);
                            data.append('contents', editor.getData());
                            data.append('seq', seq);
                            xhr.onload = function() {
                                if(xhr.readyState == XMLHttpRequest.DONE && xhr.status == 200) {
                                    seq += 1;
                                    resolve(xhr.response);
                                } else {
                                    reject({status: xhr.status, statusText : xhr.statusText});
                                }
                            }
                            xhr.send(data);
                        }
                    });
                }
            },
            typing: {
                transformations: {
                    extra: [
                        {
                            from: /^(!!date\s+)(##)$/,
                            to: [null, timeFormat()],
                        },
                        {
                            from: /(!!ai\s*\()(#)(\|?[^|]*\|?[^|]*\))$/,
                            to: [null, new String(getNextAINum()), null],
                        }
                    ],
                }
            }
        })
        .then( newEditor => {
            editor = newEditor;
            setSize();
            window.addEventListener("resize", setSize);
        } )
        .catch( error => { console.error(error); } );

    document.getElementById("title").addEventListener("input", (ev) => {
        // the only purpose of this setData() is to trigger a autosave when title changed.
        let d = editor.getData();
        let d2 = d.replaceAll("<!-- Title -->", "");
        if(d == d2) {
            d += "<!-- Title -->";
        } else {
            d = d2;
        }
        editor.setData(d);
        addVisitedPages();
    });
    addVisitedPages();
}

function onload() {
    function initiateRWKey() {
        let xhr = new XMLHttpRequest();
        xhr.open('GET', __serverBase__ + "/p/n.php");
        xhr.onload = (resp) => {
            if(xhr.status == 200) {
                let t = xhr.response;
                t = JSON.parse(t);
                console.log("createRwKey", "resp", t);
                rwkey = t["rwkey"];
                document.getElementById("rwkey").innerHTML = "<a href=\"" + __serverBase__ + "?k=" + rwkey + "\">Edit link</a>";
                seq = t["seq"];
                sessionStorage.setItem(__prefix__ + "documentTitle", JSON.stringify(rwkey));
                last_timestamp = 0;
                createEditor();
            } else {
                // try again after 500ms
                setTimeout(createRwKey, __retry_period__);
            }
        };
        xhr.onerror = (resp) => {
            // try again after 500ms
            setTimeout(createRwKey, __retry_period__);
        };
        xhr.send();
    }

    function loadFromRWKey(setting) {
        let xhr = new XMLHttpRequest();
        xhr.open('POST', __serverBase__ + "/p/r.php");
        let data = new FormData();
        data.append('k', setting);
        let ts = last_timestamp;
        data.append('ts', ts);

        xhr.onload = (resp) => {
            if(xhr.status == 200) {
                let t = xhr.response;
                t = JSON.parse(t);
                console.log("loadFromRW", "resp", t);
                if(t["contents"]) {
                    rwkey = t["rwkey"];
                    let title = t["title"];
                    seq = t["seq"];

                    // HACK : some servers need this workaround
                    let contents = t["contents"].replaceAll("\r\n", "\n");
                    document.getElementById("editor").innerHTML = contents;
                    document.getElementById("title").value = title;
                    document.getElementById("rwkey").innerHTML = "<a href=\"" + __serverBase__ + "?k=" + rwkey + "\">Edit link</a>";
                    createEditor();
                } else if(ts == 0) {
                    console.log(t);
                    // alert("Cannot find data with matching key " + key);
                }
            } else {
                // try again after 500ms
                setTimeout( () => { loadFromRWKey(key) }, __retry_period__);
            }
        };
        xhr.onerror = () => {
            setTimeout( () => { loadFromRWKey(key) }, __retry_period__);
        };
        xhr.send(data);

    }
    setting = JSON.parse(sessionStorage.getItem(__prefix__+"documentTitle"));
    if (!setting || setting == "") {
        initiateRWKey();
    } else {
        loadFromRWKey(setting);
    }
}

function newDocument() {
    sessionStorage.removeItem(__prefix__ + "documentTitle");
    window.location.replace(__serverBase__);
}

