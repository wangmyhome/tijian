//右移
$("#toRight").click(function () {
    $("#left>select>option").filter("[selected]").appendTo("#right>select");

})

//左移
$("#toLeft").click(function () {

    $("#right>select>option").filter("[selected]").appendTo("#left>select");

})

//全部右移
$("#toAllRight").click(function () {

    $("#left>select>option").appendTo("#right>select");

})

//全部左移
$("#toAllLeft").click(function () {

    $("#right>select>option").appendTo("#left>select");

})