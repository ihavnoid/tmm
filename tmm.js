__serverBase__ = "http://192.168.233.234/tmm/";
__prefix__ = "tmm_edit_";
__retry_period__ = 500;
let editor = null;
let last_timestamp = 0;
let rwkey = null;

let popupWindow = window;
let updateCallback = [];

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
    if(seq >= 100000000) {
        d["title"] += "(read-only)";
    }
    setting[rwkey] = d;
    localStorage.setItem(__prefix__ + "visitedPages", JSON.stringify(setting));
    // console.log(setting);
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

function rebuildAiTable(currentDateString) {
    if(editor == null) {
        return [];
    }
    let d = html_to_text.convert(editor.getData(), {wordwrap:9999999});
    let ai_table = [];
    let lines = d.split('\n');
    let date = timeFormat();
    let lncnt = 0;

    function addAI(number, state, owner, comment) {
        // yes, I am intending to do lexicographical compares
        if(currentDateString == null || currentDateString >= date) {
            ai_table.push({
                ln : lncnt,
                date : date,
                number : number,
                state : state,
                owner : owner,
                comment : comment
            });
        }
    }

    lines.forEach(ln => {
        lncnt++;
        let m = ln.match(/!!date\s*(.*)$/);
        if(m) {
            console.log("date", m[1]);
            date = m[1];
        }

        let m2 = ln.match(/!!ai\s*\(([0-9]*)\|([^|]*)\|([^|]*)\)(.*)$/);
        if(m2) {
            console.log("ai", m2);
            addAI(m2[1], m2[2], m2[3], m2[4]);
        }

        m2 = ln.match(/!!ai\s*\(([0-9]*)\|([^|]*)\)(.*)$/);
        if(m2) {
            console.log("ai", m2);
            addAI(m2[1], m2[2], "", m2[3]);
        }
        m2 = ln.match(/!!ai\s*\(([0-9]*)\)(.*)$/);
        if(m2) {
            console.log("ai", m2);
            addAI(m2[1], "", "", m2[2]);
        }
    });
    ai_table.sort( (a, b) => {
        if(a["number"] > b["number"]) return 1;
        else if(a["number"] < b["number"]) return -1;
        else if(a["date"] > b["date"]) return 1;
        else if(a["date"] < b["date"]) return -1;
        else if(a["ln"] > b["ln"]) return 1;
        else if(a["ln"] < b["ln"]) return -1;
        else return 0;
    });
    return ai_table;
}

function getNextAINum() {
    let ai_table = rebuildAiTable(null);
    if(ai_table.length == 0) return 1;
    return 1 + Math.max(...(ai_table.map(x => parseInt(x["number"]))));
}

function updateChildWindow() {
    let d = html_to_text.convert(editor.getData(), {wordwrap:9999999});
    if(getWindow() != window) {
        getWindow().msgpane.innerHTML = "<pre>" + d + "</pre>";
    }
}

function buildAiTableHtml() {
    // first thing to do is to find the date of the section to generate the AI html.
    // This is done by scanning through the text to find !!aitable tag,
    // and find the last '!!date' tag.
    // Default is to keep the 'date' tag nullptr (can happen, which will be all AIs)

    if(editor == null) {
        return "";
    }

    let p1 = editor.model.createPositionAt(editor.model.document.getRoot(), 0);
    let p2 = editor.model.document.selection.getFirstPosition();
    let r = editor.model.createRange(p1, p2);

    for(let x of r.getItems()) {
        if(x["textNode"]) {
            let ln = x["data"];
            let m = ln.match(/!!date\s*(.*)$/);
            if(m) {
                date = m[1];
            }
        }
    }
    console.log(date);

    let aitable = rebuildAiTable(date);
    let ret = "<table>";
    ret += "<tr><td>#</td><td>state</td><td>owner</td><td>description</td></tr>";
    let prev_num = null;
    let last_state = "";
    let last_owner = "";
    let last_comment = "";
    function emit_cell_content() {
        if(last_state == "") last_state = "open";
        ret += "<tr><td>" + prev_num + "</td><td>" + last_state + "</td><td>" + last_owner + "</td><td>" + last_comment + "</td></tr>";
    }
    for(let ln of aitable) {
        let ln_date = ln["date"].split(" ")[0];
        let ln_num = ln["number"];
        if(ln_num == prev_num) {
            ln_num = "";
            if(ln["state"] != "") {
                last_state = ln["state"];
            }
            if(ln["owner"] != "") {
                last_owner = ln["owner"];
            }
            last_comment += "(" +ln_date + ") " + ln["comment"] + "<br/>";
        } else {
            if(prev_num != null) {
                emit_cell_content(); 
            }
            prev_num = ln_num;
            last_state = "";
            last_owner = "";
            if(ln["state"] != "") {
                last_state = ln["state"];
            }
            if(ln["owner"] != "") {
                last_owner = ln["owner"];
            }
            last_comment = "(" +ln_date + ") " + ln["comment"] + "<br/>";
        }
    }
    if(prev_num != null) {
        emit_cell_content(); 
    }
    ret += "</table>";

    let pos = editor.model.document.selection.getFirstPosition();
    let viewFragment = editor.data.processor.toView(ret);
    let modelFragment = editor.data.toModel(viewFragment);
    editor.model.insertContent(modelFragment, pos);

    return "";
}

function forceTriggerUpdate(cb) {
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
    if(cb) {
        updateCallback.push(cb);
    }
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
                                    for(let cb of updateCallback) {
                                        cb();
                                    }
                                    updateCallback = [];
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
                            to: matches => [null, timeFormat()],
                        },
                        {
                            from: /(!!ai\s*\()(#)(\|?[^|]*\|?[^|]*\))$/,
                            to: matches => [null, new String(getNextAINum()), null],
                        },
                        {
                            from: /(!!aitable\s*)(##)$/,
                            to: matches => [null, buildAiTableHtml()],
                        }
                    ],
                }
            }
        })
        .then( newEditor => {
            editor = newEditor;
            setSize();
            window.addEventListener("resize", setSize);

            if(seq >= 100000000) {
                editor.enableReadOnlyMode("#editor");
                document.getElementById("title").readOnly = true;
            } else {
                editor.disableReadOnlyMode("#editor");
                document.getElementById("title").readOnly = false;
            }
        } )
        .catch( error => { console.error(error); } );

    document.getElementById("title").addEventListener("input", (ev) => {
        forceTriggerUpdate();
    });
    addVisitedPages();
}

function clonePage() {
    let xhr = new XMLHttpRequest();
    let title = document.getElementById("title").value;

    xhr.open('GET', __serverBase__ + "/p/n.php");
    xhr.onload = (resp) => {
        if(xhr.status == 200) {
            let t = xhr.response;
            t = JSON.parse(t);
            console.log("createRwKey", "resp", t);
            rwkey = t["rwkey"];
            document.getElementById("rwkey").innerHTML = rwkey.substr(0,8) + " &nbsp; <a href=\"" + __serverBase__ + "?k=" + rwkey + "\">Edit link</a>";
            seq = t["seq"];

            sessionStorage.setItem(__prefix__ + "documentTitle", JSON.stringify(rwkey));
            editor.disableReadOnlyMode("#editor");
            document.getElementById("title").readOnly = false;
        } else {
            // try again after 500ms
            setTimeout(clonePage, __retry_period__);
        }
    };
    xhr.onerror = (resp) => {
        // try again after 500ms
        setTimeout(clonePage, __retry_period__);
    };
    xhr.send();
}

function changeToReadOnly() {
    seq += 100000000;
    forceTriggerUpdate();
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
                document.getElementById("rwkey").innerHTML = rwkey.substr(0,8) + " &nbsp; <a href=\"" + __serverBase__ + "?k=" + rwkey + "\">Edit link</a>";
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
                    seq = 0 + t["seq"];

                    // HACK : some servers need this workaround
                    let contents = t["contents"].replaceAll("\r\n", "\n");
                    document.getElementById("editor").innerHTML = contents;
                    document.getElementById("title").value = title;
                    document.getElementById("rwkey").innerHTML = rwkey.substr(0,8) + " &nbsp; <a href=\"" + __serverBase__ + "?k=" + rwkey + "\">Edit link</a>";
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

