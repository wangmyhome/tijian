$(document).ready(function () {
  //“欢”块设置缺省淡入效果，“迎”块设置慢淡入效果

  //“您”块设置3000ms淡入效果后执行“欢迎您”对话框

  $("#div1").fadeIn("")
  $("#div2").fadeIn("slow")
  $("#div3").fadeIn(3000, function () {
    alert("欢迎您");
  });

});