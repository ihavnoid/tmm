__prefix__ = "tmm_edit_";
__retry_period__ = 500;
__default_table_states__ = ["open"];
__html_to_text_opt__ = {
    wordwrap: 99999999,
    selectors: [
        {
            selector: 'a',
            options: {
                hideLinkHrefIfSameAsText: true
            }
        }
    ]
};

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
    let u = findLastDate();
    if(u != "") d["updated"] = u;
    console.log(d);
    setting[rwkey] = d;
    localStorage.setItem(__prefix__ + "visitedPages", JSON.stringify(setting));
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


function findLastDate() {
    if(editor == null) {
        return "";
    }
    let d = html_to_text.convert(editor.getData(), __html_to_text_opt__);
    let lines = d.split('\n');
    let date = "";
    let lncnt = 0;

    lines.forEach(ln => {
        lncnt++;
        let m = ln.match(/!!date\s*(.*)$/);
        if(m) {
            console.log("date", m[1]);
            if(date < m[1]) date = m[1];
        }
    });
    return date;
}


function rebuildAiTable(currentDateString) {
    if(editor == null) {
        return [];
    }

    let d = html_to_text.convert(editor.getData(), __html_to_text_opt__);
    let ai_table = [];
    let lines = d.split('\n');
    let date = timeFormat();
    let lncnt = 0;

    function addAI(number, state, owner, description, comment) {
        // yes, I am intending to do lexicographical compares
        if(currentDateString == null || currentDateString >= date) {
            ai_table.push({
                ln : lncnt,
                date : date.trim(),
                number : number.trim(),
                state : state.trim(),
                owner : owner.trim(),
                description : description.trim(),
                comment : comment.trim()
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
            addAI(m2[1], m2[2], m2[3], m2[4], "");
        }

        m2 = ln.match(/!!ai\s*\(([0-9]*)\|([^|]*)\)(.*)$/);
        if(m2) {
            console.log("ai", m2);
            addAI(m2[1], m2[2], "", m2[3], "");
        }
        m2 = ln.match(/!!ai\s*\(([0-9]*)\)(.*)$/);
        if(m2) {
            console.log("ai", m2);
            addAI(m2[1], "", "", m2[2], "");
        }
        m2 = ln.match(/!!comment\s*\(([0-9]*)\)(.*)$/);
        if(m2) {
            console.log("comment", m2);
            addAI(m2[1], "", "", "", m2[2]);
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

function buildAiTableHtml(valid_states) {
    // first thing to do is to find the date of the section to generate the AI html.
    // This is done by scanning through the text to find !!aitable tag,
    // and find the last '!!date' tag.
    // Default is to keep the 'date' tag nullptr (can happen, which will be all AIs)

    if(editor == null) {
        return "";
    }
    
    if(valid_states == null) {
        // empty
    }
    else if(valid_states.includes("*")) {
        valid_states = null;
    }
    else if(valid_states.length == 0) {
        valid_states = __default_table_states__;
    }
    else if(valid_states.length == 1 && valid_states[0] == "") {
        valid_states = __default_table_states__;
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
    let ret = "<figure class='table'><table style='border: 1px solid #000000;'>";
    let th_style = "style='background-color:#c0c0c0;border:1px solid #000000;'"
    let td_style = "style='border:1px solid #000000;'"
    let generate_th = s => "<td "+th_style+"><strong>"+s+"</strong></td>";
    ret += "<tr>"+generate_th("#") + generate_th("state") + generate_th("owner") + generate_th("description") + generate_th("comment") + "</tr>";
    let prev_num = null;
    let last_state = "";
    let last_owner = "";
    let last_comment = "";
    let last_description = "";
    function emit_cell_content() {
        if(last_state == "") last_state = "open";
        // console.log(valid_states, last_state);
        if(valid_states == null || valid_states.includes(last_state)) {
        let generate_td = s => "<td "+td_style+">"+s+"</td>";
            ret += "<tr>" +generate_td(prev_num) +generate_td(last_state) +generate_td(last_owner) +generate_td(last_description) +generate_td(last_comment) +"</tr>";
        }
    }
    function update_ln(ln) {
        let ln_date = ln["date"].split(" ")[0];
        if(ln["state"] != "") {
            last_state = ln["state"];
        }
        if(ln["owner"] != "") {
            last_owner = ln["owner"];
        }
        if(ln["description"] != "") {
            last_description = ln["description"];
        }
        if(ln["comment"] != "") {
            if(last_comment == "") {
                last_comment += "(" +ln_date + ") " + ln["comment"];
            } else {
                last_comment += "<br/>(" +ln_date + ") " + ln["comment"];
            }
        }

    }
    for(let ln of aitable) {
        let ln_num = ln["number"];
        if(ln_num == prev_num) {
            update_ln(ln);
        } else {
            if(prev_num != null) {
                emit_cell_content(); 
            }
            prev_num = ln_num;
            last_state = "";
            last_owner = "";
            last_comment = "";
            last_description = "";
            update_ln(ln);
        }
    }
    if(prev_num != null) {
        emit_cell_content(); 
    }
    ret += "</table><figure>";

    let pos = editor.model.document.selection.getFirstPosition();
    let viewFragment = editor.data.processor.toView(ret);
    let modelFragment = editor.data.toModel(viewFragment);
    editor.model.insertContent(modelFragment, pos);

    return "";
}

function forceTriggerUpdate(cb) {
    if(cb) {
        updateCallback.push(cb);
    }
    editor.plugins.get('Autosave').save().then(() => {});
}

function buildSnapshotLink() {
    editor.enableReadOnlyMode("#editor");
    let xhr = new XMLHttpRequest();
    xhr.open('GET', __serverBase__ + "/p/n.php");
    xhr.onload = (resp) => {
        if(xhr.status == 200) {
            let t = xhr.response;
            t = JSON.parse(t);
            let tgt_rwkey = t["rwkey"];
            let tgt_seq = t["seq"];

            let ret = "<a href=\"" + __serverBase__ + "/?k="+tgt_rwkey+"\">Link</a>";
            let pos = editor.model.document.selection.getFirstPosition();
            let viewFragment = editor.data.processor.toView(ret);
            let modelFragment = editor.data.toModel(viewFragment);
            editor.model.insertContent(modelFragment, pos);

            function postData() {
                let tgt_data = editor.getData();
                let title = document.getElementById("title").value;

                xhr.open('POST', __serverBase__ + "/p/w.php");
                let data = new FormData();
                data.append('k', tgt_rwkey);
                data.append('title', title);
                data.append('sync', 1);
                data.append('contents', tgt_data);
                data.append('seq', tgt_seq + 100000000);
                xhr.onload = function() {
                    if(xhr.readyState == XMLHttpRequest.DONE && xhr.status == 200) {
                        editor.disableReadOnlyMode("#editor");
                    } else {
                        setTimeout(postData, __retry_period__);
                    }
                }
                xhr.send(data);
            }
            postData();

        } else {
            // try again after 500ms
            setTimeout(buildSnapshotLink, __retry_period__);
        }
    };
    xhr.onerror = (resp) => {
        // try again after 500ms
        setTimeout(buildSnapshotLink, __retry_period__);
    };
    xhr.send();

    return "";
}

function createEditor() {
    let updating = false;
    ClassicEditor
        .create( document.querySelector('#editor'), {
            simpleUpload: {
                uploadUrl: "image_upload.php",
                withCredentials: false
            },
            autosave: {
                save(editor) {
                    updateChildWindow();
                    addVisitedPages();
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
                            to: matches => [null, buildAiTableHtml(["open"])],
                        },
                        {
                            from: /(!!aitable\s*\()([^\)]*)(\)\s*)(##)$/,
                            to: matches => [null, null, null, buildAiTableHtml(
                                    matches[1].split("|").map(x=>x.trim())
                            )],
                        },
                        {
                            from: /(!!snapshot\s*)(##)$/,
                            to: matches => [null, buildSnapshotLink()],
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
                document.getElementById("change_to_read_only").style.visibility="hidden";
            } else {
                editor.disableReadOnlyMode("#editor");
                document.getElementById("title").readOnly = false;
                document.getElementById("change_to_read_only").style.visibility="visible";
            }
            addVisitedPages();
        } )
        .catch( error => { console.error(error); } );

    document.getElementById("title").addEventListener("input", (ev) => {
        if( updating ) return false;
        
        updating = true;
        setTimeout( () => {
            forceTriggerUpdate();
            updating = false;
        }, 2000);
    });
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
            document.getElementById("change_to_read_only").style.visibility="visible";
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

