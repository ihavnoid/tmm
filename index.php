<!DOCTYPE html>
<?php
    if(array_key_exists("k", $_GET)) {
        // addslashes shouldn't be useful here, but this is to block code injection type thingies
        $k = addslashes($_GET["k"]);
?>
<html>
    <header>
    <script src="tmm.js"></script>
    <script>
        sessionStorage.setItem(__prefix__ + "documentTitle", JSON.stringify("<?php echo $k; ?>"));
        window.location.replace(__serverBase__);
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
<style>
    #title {
        font-size: 24px;
        margin: 12px;
    };
</style>
<script src="ckeditor.js"></script>
<script src="tmm.js"></script>
</head>
<body onload="onload()">
<div id="maineditor">
<div>
    Document title : <input type="text" id="title" placeholder="(Please put document title here)" size=50></input>
    <span id="newdoc"><a href="javascript:newDocument()">New</a></span>
    <span id="rwkey"></span>
</div>

<div id="editor"></div>
</div>
</body>
</html>
