<html>
<head>
<meta charset="utf-8"/>
<style>
</style>
<script src="ckeditor.js"></script>
<script>

let editor;
function onload() {
    function MinHeightPlugin(editor) {
      this.editor = editor;
    }
    
    MinHeightPlugin.prototype.init = function() {
      this.editor.ui.view.editable.extendTemplate({
        attributes: {
          style: {
            minHeight: 'calc(100% - 200px)',
            maxHeight: 'calc(100% - 200px)'
          }
        }
      });
    };
    
    ClassicEditor.builtinPlugins.push(MinHeightPlugin);

    ClassicEditor
        .create( document.querySelector('#editor'), {
            simpleUpload: {
                uploadUrl: "image_upload.php",
                withCredentials: false
            },
        })
        .then( newEditor => {
            editor = newEditor;
        } )
        .catch( error => { console.error(error); } );
}

</script>
</head>
<h2>t2mm</h2>
<body onload="onload()">
<div id="editor"></div>
</body>
