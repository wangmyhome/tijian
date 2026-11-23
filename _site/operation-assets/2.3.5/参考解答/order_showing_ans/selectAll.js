//点击全选按钮，完成全选功能
$("#checkAll").click(function () {
    $("input[type='checkbox']").checkAll();
});

//点击全不选按钮，完成全不选功能
$("#uncheckAll").click(function () {
    $("input[type='checkbox']").uncheckAll();
});

//点击反选按钮，完成反选功能
$("#checkInvert").click(function () {
    $("input[type='checkbox']").checkInvert();
});