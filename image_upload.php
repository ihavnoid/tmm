<?php

$upload_dir = "./image_path/";

$fn = $_FILES['upload']['name'];
$hash = sha1_file($_FILES['upload']['tmp_name']);
$fn = $hash."_".basename($fn);

$msg = "";
if (move_uploaded_file($_FILES['upload']['tmp_name'], $upload_dir.$fn)) {
    // empty
} else {
    $msg = "Possible file upload attack!\n";
}

if($msg == "") {
    echo json_encode( array("url" => "image_path/".$fn) );
} else {
    echo json_encode( array("msg" => $msg) );
}

?>
