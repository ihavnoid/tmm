<!DOCTYPE html>
<?php
    $config = json_decode(file_get_contents(__DIR__."/config.json"), true);
    if(array_key_exists("k", $_GET)) {
        // addslashes shouldn't be useful here, but this is to block code injection type thingies
        $k = addslashes($_GET["k"]);
?>
<html>
    <header>
    <script src="html_to_text.js"></script>
    <script src="tmm.js"></script>
    <script>
        sessionStorage.setItem(__prefix__ + "documentTitle", JSON.stringify("<?php echo $k; ?>"));
        window.location.replace("<?php echo $config["base_url"];?>");
    </script>
    </header>
<body> &nbsp; </body>
</html>
<?php
        exit(0);
    }
?>

<html>
<head>
<meta charset="utf-8"/>
<script>
        __serverBase__ = "<?php echo $config["base_url"];?>";
</script>
<script src="ckeditor.js"></script>
<script src="html_to_text.js"></script>
<script src="tmm.js"></script>
<style>
    #title {
        font-size: 24px;
        margin: 12px;
    }
    #newdoc {
        margin: 10px;
    }
    #clonepage {
        margin: 10px;
    }
    #visited {
        margin: 10px;
    }
    #rwkey {
        margin: 10px;
    }
    #helpwindow {
        z-index: 100;
        visibility: hidden;
        position: absolute;
        top: 50px;
        left: 50px;
        width: 800px;
        height: 400px;
        background: white;
        padding: 10px;
        border: 1px solid #000000;
    }
    .helptable {
        margin: 5px;
        border: 1px solid #303030;
    }
</style>
<script>
    function toggleHelp() {
        if(document.getElementById("helpwindow").style.visibility == "visible")
            document.getElementById("helpwindow").style.visibility = "hidden";
        else
            document.getElementById("helpwindow").style.visibility = "visible";
    }
</script>
</head>
<body onload="onload()">
<div id="helpwindow">
<b>Click the (?) to hide help messages.</b><br/>
<table class="helptable" rules="all">
<tr><th width="300px">Code</th><th>Description</th></tr>
<tr><td><i>!!date (date)</i></td><td>Date of the meeting minutes.  All text below will be considered to be the
    minutes of the date until we meet another <i>!!date</i> code.  To autofill date, type <i>!!date ##</i>.
</td></tr>
<tr><td><i>!!ai(num|state|owner) description </i></td><td>Create an action item.  number can be "#" which will be
autofilled.  If state is omitted, default will be 'open'.</td></tr>
<tr><td><i>!!comment(num) some_comment</i></td><td>Add a comment to the action item number <i<num</i>.</td></tr>
<tr><td><i>!!aitable(state1|state2|...) ##</i></td><td>Auto-insert an 'action item table' which summarizes the outstanding action items.  You can specify which states you want; if state list is empty, default is to only show 'open' state items.  If you want all states, put in <i>*</i> state.</td></tr>
</table>
</div>
<div id="maineditor">
<div>
    <span> &nbsp; <a href="javascript:toggleHelp()">(?)</a> &nbsp; </span>
    Document title : <input type="text" id="title" placeholder="(Please put document title here)" size=50></input>
    <span id="newdoc"><a href="javascript:newDocument()">New</a></span>
    <span id="clonepage"><a href="javascript:clonePage()">Clone</a></span>
    <span id="change_to_read_only"><a href="javascript:changeToReadOnly()">Change to read-only</a></span>
    <span id="visited"><a href="visited.php" target="_blank">Show pages visited</a></span>
    <span id="rwkey"></span>
    <!-- <span id="summary"><a href="javascript:openPopup()">Show summary pages</a></span> -->
</div>

<div id="editor"></div>
</div>
</body>
</html>
