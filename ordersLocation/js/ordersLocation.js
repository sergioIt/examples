/**
 * Created by sergio on 08.05.15.
 */

PetsAdmin = {};
//пространство имёно для распредеелния заказов на доставку
PetsAdmin.deliveryLocation = {};

/**
 * скрывает область непосредственнгого распредеелния на карте
 * и скрывает всё остальное
 */
PetsAdmin.deliveryLocation.hideAllocationArea = function(){

    $('#allocation_area').hide();
    $('#OrdersForAllocation').hide();
    $('#allocationResults').hide();
    //$('#btnGetAllocation').hide();

};
/**
 * инициализация распределения
 */
PetsAdmin.deliveryLocation.init = function(){

    //$('#addr').hide(); //скрываем div, в котором собраны все адреса для распеределения
    $('#allocationResults').hide(); //скрываем итоги распеределения
    $('.inputErrCourier').hide(); //скрываем ошибку ввода курьера
    $('#OrdersForAllocation').hide(); //скрываем ошибку ввода курьера
    $('#debug').hide(); //скрываем ошибку ввода курьера
    $('#orderControl').hide(); //скрываем управление выбранным заказом
    $('.frmSetZoneToCourier').hide();
    $('#unassignedContent').hide();
    $('.frmCreateList').hide(); // скрываем форму создания листа, т.к. вначале нет назначенных заказов
    $('.allocatedContent').hide(); // скрываем итоги автораспределния по зонам, оставляем только заголовки
    $('#btnGetAllocation').hide(); // скрываем кнопку запуска распределения по зонам, пока не инциализируется карта
    $('#btnCollapseAssigned').hide(); // скрываем кнопку схлопывания курьеров

    PetsAdmin.deliveryLocation.createUnassignedList();
    PetsAdmin.deliveryLocation.updateUnassignedCount();
// Дождёмся загрузки API и готовности DOM.
    //ymaps.ready(PetsAdmin.deliveryLocation.initMap);
    ymaps.ready(PetsAdmin.deliveryLocation.readZoneCoordinates);
};

/**
 * обновляет страницу
 */
PetsAdmin.deliveryLocation.reload = function(){
    window.location.reload();
};
/**
 * переключение видимости содежрания окна курьера
 */
PetsAdmin.deliveryLocation.toggleCourier = function(){
    $(this).parent().find('.courierOrdersContent').toggle();
};
/**
 * переключает видимость содержания неназначенных заказов
 */
PetsAdmin.deliveryLocation.toggleUnassigned = function(){
   $('#unassignedContent').toggle();
};
/**
 *  переключает видимость содержания распределённых по зоне заказов
 */
PetsAdmin.deliveryLocation.toggleAssigned = function(){
   $(this).parent().find('.allocatedContent').toggle();
};
/**
 * закрывает окно заказа
 */
PetsAdmin.deliveryLocation.closeOrderWindow = function(){
   $('#orderControl').hide();
};
/**
 * схлапывает окна с курьерами  их заказами
 */
/*PetsAdmin.deliveryLocation.collapseCouriersWindows = function(){
   $('.courierOrdersContent').hide();
};*/
/**
 * получение данных о неназначенном заказе, добавление соответствующей метки на карте
 */
PetsAdmin.deliveryLocation.getUnassignedOrderDetails = function(){

    var order = {};

    var order_item = $(this).parent();
    var order_id = $(this).text();
    var address = order_item.find('.address').text();
    var comments = order_item.find('.comments').text();

    order['orderId'] = order_id;
    order['address'] = address;
   // order['comments'] = comments;

    $('#orderControl').show();
    $('#controlOrderId').text(order_id);
    $('#controlOrderAddress').text(address);
    $('#controlOrderComments').text(comments);
    setPointUnassigned(order);
};

/**
 * назначет заказы из зоны на курьера
 */
PetsAdmin.deliveryLocation.assignOrdersFromZoneToCourier = function(){
    var zoneId = $(this).parent().find('.selectZone').val();
    // id блока, в котором находится курьер, нужен для цветовой идентификации курьера и его меток на карте
    var blockId = $(this).attr('data-id');
    console.log('blockId: '+blockId);
    var pushTarget = $(this).parent().parent().find('.courierOrders ol');
    var formCreateList = $(this).parent().parent().find('.frmCreateList');
    // находим блок, из которого будем брать заказы
    var pullTarget = $('#zone'+zoneId);
    var orders = pullTarget.find('li');

    var ordersCourier = [];
    orders.each(function () {

        ordersCourier.push(
            {
                orderId:  $(this).find('span.orderId').text(),
                address: $(this).find('span.address').text()
            });
    });
    ordersCourier.forEach(function(order)
    {
        // если заказа ещё нет у этого курьера
        if(PetsAdmin.deliveryLocation.countAssignedForBlock(blockId,order['orderId']) == 0)
        {
            // и если заказ есть среди нераспределённых
            if(PetsAdmin.deliveryLocation.countUnassignedOrder(order['orderId']) > 0)
            {
                var orderElement = createAssignedElement(order);
                var hiddenElement = createHiddenInput(order);
                pushTarget.append(orderElement);
                formCreateList.append(hiddenElement);

                removeFromUnAssigned(order['orderId']);
                setPointCourier(order,blockId);
            }

        }

    });

    PetsAdmin.deliveryLocation.updateAssignedCount(blockId);
    PetsAdmin.deliveryLocation.updateUnassignedCount();
    formCreateList.show();
};

/**
 * назначает отдельный заказ на курьера
 */
PetsAdmin.deliveryLocation.assignOrderToCourier = function(){
    // определяем, какой курьер выбран
    var block_id = $(this).parent().parent().find('.selectCourier').val();
    console.log('select curier:'+block_id);

        var targetContent = $('#courier'+block_id+ ' .courierOrdersContent .courierOrders ol');
      //  console.log(targetContent);

        var targetFormCreateList = $('#courier'+block_id+ ' .courierOrdersContent .frmCreateList');

        var orderForAssign = {};
        orderForAssign['orderId'] = $('#controlOrderId').text();
        orderForAssign['address'] = $('#controlOrderAddress').text();
      //  console.log('order for assign: ' +orderForAssign);

        if(PetsAdmin.deliveryLocation.countAssignedForBlock(block_id,orderForAssign['orderId']) == 0)
        {
            // и если заказ есть среди нераспределённых
            if(PetsAdmin.deliveryLocation.countUnassignedOrder(orderForAssign['orderId']) > 0)
            {
                var orderElement = createAssignedElement(orderForAssign);
                targetContent.append(orderElement);
                var hiddenInput = createHiddenInput(orderForAssign);
                targetFormCreateList.append(hiddenInput);
                removeFromUnAssigned(orderForAssign['orderId']);
                setPointCourier(orderForAssign,block_id);
            }

            PetsAdmin.deliveryLocation.updateAssignedCount(block_id);
            PetsAdmin.deliveryLocation.updateUnassignedCount();

            targetFormCreateList.show();

            $('#orderControl').hide('slowly');
        }

};
/**
 * ===================== Functions ====================================
 */

/**
 * создаёет элемент с назначенным заказом
 * @param order
 */
function createAssignedElement(order)
{
    var orderElement = document.createElement("li");
    var orderIdElement = document.createElement("span");
    var orderAddrElement = document.createElement("span");
    orderIdElement.setAttribute('class','label label-primary orderId');
    orderAddrElement.setAttribute('class','address');
    orderIdElement.appendChild(document.createTextNode(order['orderId']));
    orderAddrElement.appendChild(document.createTextNode(order['address']));
    orderElement.appendChild(orderIdElement);
    orderElement.appendChild(orderAddrElement);

    return orderElement;
}
/**
 * создаёт скрытй input для передачи через ajax при создании маршрутного листа
 * @param order
 */
function createHiddenInput(order)
{
    var inputElement = document.createElement("input");
    inputElement.setAttribute('type','hidden');
    inputElement.setAttribute('name','orderId[]');
    inputElement.setAttribute('value',order['orderId']);

    return inputElement;
}
/**
 * скрыавет заказ из неназначенных
 * @param orderId - id заказа
 */
function removeFromUnAssigned(orderId)
{
    var target = $('#unassignedContent');

    target.find('li:contains('+orderId+')').addClass('assigned').removeClass('unassigned').hide();
//    console.log('remove from unassigned');
}
/**
 * Проверяет, назначен ли заказ orderId курьеру courierId
 * @param block_id id блока, соответствующего курьеру
 * @param orderId номер заказа
 */
PetsAdmin.deliveryLocation.countAssignedForBlock = function(block_id,orderId)
{
    return  $('#courier'+block_id+' .courierOrdersContent .courierOrders li span.orderId:contains('+orderId+')').length;
    /*if(count > 0)
    {
        return true;
    }

    return false;*/
};
/**
 * проверяет, есть ли заказ среди нераспределённых
 * @param orderId
 */
PetsAdmin.deliveryLocation.countUnassignedOrder = function isOrderNotAssigned(orderId)
{
    var target = $('#unassignedContent');
     return target.find('li.unassigned span.unallocatedLabel:contains('+orderId+')').length;

};

/**
 * пересчитывает число заказов для курьера
 * @param block_id
 */
PetsAdmin.deliveryLocation.updateAssignedCount = function(block_id)
{
   // var div = $('#courier'+courierId+' .courierOrdersContent');
   // console.log(div);
   var count = $('#courier'+block_id+' .courierOrdersContent .courierOrders li').length;

    console.log('orders count:' + count);
    $('#courier'+block_id+' .courierHeader .courierOrdersCount').text(count);
};

/**
 * обновлеят число неназначенных заказов
 */
PetsAdmin.deliveryLocation.updateUnassignedCount = function()
{
    var list = $('#unassignedContent');
    var count =  list.find('li.unassigned').length;
    //console.log('нераспределённых:'+count);
    $('#unassignedCount').text(count);
};
/**
 * подсчитывает число заказов в кажддом блоке автораспределения по зонам
 */
function allocatedCount(zoneId)
{
        var count = $('#zone'+zoneId+' .ordersAllocated li').length;
       // console.log(count);
    $('#zone'+zoneId+' .zoneOrdersCount').text(count);
}
/**
 * считаем, сколько заказов находится в непопавших в зоны и выводит в заголовок блока
 */
PetsAdmin.deliveryLocation.updateUnAllocatedCount = function()
{
    var target = $('#notAllocated');
    var count = target.find('.ordersAllocated li').length;
    //console.log(count);
    target.find('.zoneOrdersCount').text(count);
};

PetsAdmin.deliveryLocation.readZoneCoordinates = function(){

    $.getJSON("js/zones_coordinates.json", function(json) {
        //var zone_zoords = json["zone1"];
       // console.log(coords); // this will show the info it in firebug console
        console.log('test'); // this will show the info it in firebug console

        PetsAdmin.deliveryLocation.initMap(json);

    });
};
/**
 * инициализация яндекс-карты со всеми начальными объектами
 */
PetsAdmin.deliveryLocation.initMap = function(zone_coordinates)
{
    // Создание экземпляра карты и его привязка к контейнеру с заданным id ("map").
    myMap = new ymaps.Map('map', {
        // При инициализации карты обязательно нужно указать
        // её центр и коэффициент масштабирования.
        center: [59.94, 30.28],
        zoom: 11
    }, // коллекция для всех точек
        allPoints = new ymaps.GeoObjectCollection(null, {
            preset: 'islands#blueIcon'
        }),
        // колллекция для курьера из блока с  id=1
        courierCollection1 =
            new ymaps.GeoObjectCollection(null, {
                preset: 'islands#yellowCircleIcon'
            }),
        // колллекция для курьера из блока с  id=2
        courierCollection2 =
            new ymaps.GeoObjectCollection(null, {
                preset: 'islands#brownCircleIcon'
            }),
        // колллекция для курьера из блока с  id=3
        courierCollection3 =
            new ymaps.GeoObjectCollection(null, {
                preset: 'islands#redCircleIcon'
            }),
        // колллекция для курьера из блока с  id=4
        courierCollection4 =
            new ymaps.GeoObjectCollection(null, {
                preset: 'islands#blueCircleIcon'
            }),
        // колллекция для курьера из блока с  id=5
        courierCollection5 =
            new ymaps.GeoObjectCollection(null, {
                preset: 'islands#darkGreenCircleIcon'
            }),// колллекция для курьера из блока с  id=6
        courierCollection6 =
            new ymaps.GeoObjectCollection(null, {
                preset: 'islands#violetCircleIcon'
            }),

        unAssignedCollection =
            new ymaps.GeoObjectCollection(null, {
                preset: 'islands#redIcon'
            }),
        // коллекция для точек, попавших в какую-либо зону
        allocatedCollection = new ymaps.GeoObjectCollection(null, {
            preset: 'islands#grayCircleDotIcon'
        }),
        // коллекция для точек, не попавших ни в одну зону
        notAllocatedCollection = new ymaps.GeoObjectCollection(null, {
            preset: 'islands#redCircleDotIcon'
        })

    );
  myMap.events.add('click', function (e) {
      //  if(!myMap.balloon.isOpen()) {
            var clcoord = e.get('coords');
        console.log(clcoord);

    });
    var zone1 = new ymaps.Polygon([
        // Указываем координаты вершин многоугольника.
        // Координаты вершин внешнего контура.
        zone_coordinates["zone1"]
,
        // Координаты вершин внутреннего контура.
        [
        ]
    ], {
        // Описываем свойства геообъекта.
        // Содержимое балуна.
        hintContent: "Юго-Восток"
    }, {
        // Задаем опции геообъекта.
        // Цвет заливки.
        fillColor: 'rgba(54, 158, 190, 0.75)',
        // Ширина обводки.
        strokeWidth: 2
    });
    var zone2 = new ymaps.Polygon([
        // Указываем координаты вершин многоугольника.
        // Координаты вершин внешнего контура.
        zone_coordinates["zone2"]
        ,
        // Координаты вершин внутреннего контура.
        []
    ], {
        // Описываем свойства геообъекта.
        // Содержимое балуна.
        hintContent: "Юго-Запад"
    }, {
        // Задаем опции геообъекта.
        // Цвет заливки.
        fillColor: 'rgba(65, 190, 104, 0.75)',
        // Ширина обводки.
        strokeWidth: 2
    });
    var zone3 = new ymaps.Polygon([
        // Указываем координаты вершин многоугольника.
        // Координаты вершин внешнего контура.
        zone_coordinates["zone3"]
      ,
        // Координаты вершин внутреннего контура.
        [
            /*  [55.75, 37.52],
             [55.75, 37.68],
             [55.65, 37.60]*/
        ]
    ], {
        // Описываем свойства геообъекта.
        // Содержимое балуна.
        hintContent: "Центр"
    }, {
        // Задаем опции геообъекта.
        // Цвет заливки.
        fillColor: 'rgba(207, 204, 74, 0.75)',
        // Ширина обводки.
        strokeWidth: 2
    });
    var zone4 = new ymaps.Polygon([
        // Указываем координаты вершин многоугольника.
        // Координаты вершин внешнего контура.
       zone_coordinates["zone4"]
        ,
        // Координаты вершин внутреннего контура.
        [

        ]
    ], {
        // Описываем свойства геообъекта.
        // Содержимое балуна.
        hintContent: "Восток"
    }, {
        // Задаем опции геообъекта.
        // Цвет заливки.
        fillColor: 'rgba(207, 125, 118, 0.75)',
        // Ширина обводки.
        strokeWidth: 2
    });
    var zone5 = new ymaps.Polygon([
        // Указываем координаты вершин многоугольника.
        // Координаты вершин внешнего контура.
        zone_coordinates["zone5"]
        ,
        // Координаты вершин внутреннего контура.
        [

        ]
    ], {
        // Описываем свойства геообъекта.
        // Содержимое балуна.
        hintContent: "Север"
    }, {
        // Задаем опции геообъекта.
        // Цвет заливки.
        fillColor: 'rgba(207, 126, 199, 0.75)',
        // Ширина обводки.
        strokeWidth: 2
    });
    var zone6 = new ymaps.Polygon([
        // Указываем координаты вершин многоугольника.
        // Координаты вершин внешнего контура.
        zone_coordinates["zone6"]
        ,
        // Координаты вершин внутреннего контура.
        [

        ]
    ], {
        // Описываем свойства геообъекта.
        // Содержимое балуна.
        hintContent: "Крайний север"
    }, {
        // Задаем опции геообъекта.
        // Цвет заливки.
        fillColor: 'rgba(116, 119, 207, 0.75)',
        // Ширина обводки.
        strokeWidth: 2
    });
// add zones to map, else further functional will not work
   myMap.geoObjects.add(zone1).add(zone2).add(zone3).add(zone4).add(zone5).add(zone6);

      //  $(this).hide(); // скрываем сам кнопку, исключаем повторное нажатие
        $('.frmSetZoneToCourier').show(); // показываем назначениезоны курьерам
        $('#allocationResults').show(); // показываем блок с результатаи распределения
        $('#btnCollapseAssigned').show(); // показываем  кнопку схлопывания курьеров

        var orders = PetsAdmin.deliveryLocation.getOrdersForAllocation();

        orders.forEach(
            function(object){
                if(object.hasOwnProperty('address'))
                {
                    //  console.log(object['address']);
                    var addr = object['address'];
                    containsZone(zone1,addr,function(){
                            // console.log('this:'+this);
                            appendOrderToList(1,object);
                            allocatedCount(1);
                            setPointAllocated(object);
                        },
                        // if not contain zone1
                        function(){
                            containsZone(zone2,addr,function(){
                                    //console.log('this:'+this);
                                    appendOrderToList(2,object);
                                    allocatedCount(2);
                                    setPointAllocated(object);
                                },
                                // if not contain zone2
                                function(){
                                    containsZone(zone3,addr,function(){
                                            // console.log('this:'+this);
                                            appendOrderToList(3,object);
                                            allocatedCount(3);
                                            setPointAllocated(object);
                                        },
                                        // if not contain zone3, try zone 4
                                        function(){
                                            containsZone(zone4,addr,function(){
                                                    //  console.log('this:'+this);
                                                    appendOrderToList(4,object);
                                                    allocatedCount(4);
                                                    setPointAllocated(object);
                                                },
                                                // if not contain zone4, try zone 5
                                                function(){
                                                    containsZone(zone5,addr,function(){
                                                            appendOrderToList(5,object);
                                                            allocatedCount(5);
                                                            setPointAllocated(object);
                                                        },
                                                        // if not contain zone5, try zone 6
                                                        function()
                                                        {
                                                            containsZone(zone6,addr,function(){
                                                                    appendOrderToList(6,object);
                                                                    allocatedCount(6);
                                                                    setPointAllocated(object);
                                                                },
                                                                // if not contain zone6, set this addr not allocated
                                                                function(){
                                                                    PetsAdmin.deliveryLocation.appendOrderToNotAllocated(object);
                                                                    PetsAdmin.deliveryLocation.updateUnAllocatedCount();
                                                                    setPointNotAllocated(object);
                                                                    // подсчёт количества заказов в каждом блоке
                                                                }
                                                            );
                                                        }
                                                    );
                                                }
                                            );
                                        });
                                });
                        }
                    );
                }
                else
                {
                    console.log('error: object "order" has no property "address"');
                }
            }
        );

   // });
    PetsAdmin.deliveryLocation.scrollToTop();

//console.log('code after contains zone call');
}; // end of init function


/**
 * создаёт маршрутный лист
 * @param event
 * @returns {boolean}
 */
PetsAdmin.deliveryLocation.createList = function (event){
    event.preventDefault();
    var pushTarget = $(this).parent();
        var formData = new FormData($(this)[0]);
        console.log('formData:'+formData);

        var request = $.ajax({
            type: 'post',
            data:formData ,
            contentType: false,
            processData: false,
            url: "actionCreateDeliveryList.php",
            error: function debugReport(jqXHR){
                console.log(jqXHR.status);
                console.log(jqXHR.statusText);
                console.log(jqXHR.responseText);
                console.log('Error connecting server or getting server response!');
            },
            beforeSend: function loader() {
            },
            complete: function hideLoader() {
            }
        });
        request.done(function (res) {
           // console.log('done');
           // $('#notify').show().html(res).fadeOut(3000);
            //$('#debug').show().html(res);
            pushTarget.html(res);
            //parentDiv.hide();
        });
   // }
    return false;
};

/**
 * Определяет, попадает точка в зону или нет
 * @param zone объект типа полигон
 * @param address координаты точки
 * @param callback1 функция, выполняемая в случае, если точка попала в зону
 * @param callback2 функция, выполняемая в случае, если точка не попала в зону
 */
function containsZone(zone,address,callback1,callback2)
{
        var myGeocoder = ymaps.geocode(address);
        myGeocoder.then(
            function(res) {
                var coordinates = res.geoObjects.get(0).geometry.getCoordinates();
             //   console.log(coordinates);
               var contains = zone.geometry.contains(coordinates);
               //  console.log(contains);
               if(contains)
               {
                   callback1.call(address);
                }
                else
               {
                   callback2.call(address);
               }
            }
        );
}

/**
 * ставит точку на карте при назначении отдельного заказа курьеру
 * @param order
 */
function setPointUnassigned(order)
{

    var myGeocoder = ymaps.geocode(order['address']);
    myGeocoder.then(
        function (res) {

            var coords = res.geoObjects.get(0).geometry.getCoordinates()
            console.log(coords);
            var pm = new ymaps.Placemark(
                coords, {
                },
                {
                    // hasBaloon: false,
                    hasHint: false,
                    // preset: 'islands#grayIcon',
                    //iconColor: 'twirl#greyIcon',
                    hideIconOnBalloonOpen: false
                    // iconImageOffset: [-3, -42]
                }
            );
            pm.events.add('click', function (e) {
                // myMap.geoObjects.options.set('preset', 'islands#redIcon');

                e.get('target').options.set('preset', 'islands#greenIcon');
                $('#orderControl').show();
                $('#controlOrderId').text(order['orderId']);
                $('#controlOrderAddress').text(order['address']);
            });
            unAssignedCollection.removeAll();
            unAssignedCollection.add(pm);
            myMap.geoObjects.add(unAssignedCollection);
        }
    );
}
/**
 * Ставит одну метку н акарте, при назначении отдельного заказа курьеру
 * @param order
 * @param courierId
 */
function setPointCourier(order, courierId)
{
    var myGeocoder = ymaps.geocode(order['address']);
    myGeocoder.then(
        function (res) {

            var coords = res.geoObjects.get(0).geometry.getCoordinates()
            //console.log(coords);
            var pm = new ymaps.Placemark(
                coords, {
                },
                {
                    balloonContent: order['address']
                   // hasHint: true,
                    // preset: 'islands#grayIcon',
                    //iconColor: 'twirl#greyIcon',
                    //hideIconOnBalloonOpen: false
                    // iconImageOffset: [-3, -42]
                }
            );
            // навешиваем событие при клике на метке-появляется окно назначения заказа
            pm.events.add('click', function () {
                // myMap.geoObjects.options.set('preset', 'islands#redIcon');

               // e.get('target').options.set('preset', 'islands#greenIcon');
                $('#orderControl').show();
                $('#controlOrderId').text(order['orderId']);
                $('#controlOrderAddress').text(order['address']);
            });
            if(courierId == 1)
            {
                courierCollection1.add(pm);
                myMap.geoObjects.add(courierCollection1);
            }
            if(courierId == 2)
            {
                courierCollection2.add(pm);
                myMap.geoObjects.add(courierCollection2);
            }
            if(courierId == 3)
            {
                courierCollection3.add(pm);
                myMap.geoObjects.add(courierCollection3);
            }
            if(courierId == 4)
            {
                courierCollection4.add(pm);
                myMap.geoObjects.add(courierCollection4);
            }
            if(courierId == 5)
            {
                courierCollection5.add(pm);
                myMap.geoObjects.add(courierCollection5);
            }
            if(courierId == 6)
            {
                courierCollection6.add(pm);
                myMap.geoObjects.add(courierCollection6);
            }
        }
    );
}
/**
 * ставит точку, попавшую в зону
 * @param order
 */
function setPointAllocated(order)
{
    var myGeocoder = ymaps.geocode(order['address']);
    myGeocoder.then(
        function (res) {

            var coords = res.geoObjects.get(0).geometry.getCoordinates()
            var pm = new ymaps.Placemark(
                coords, {
                     balloonContent: order['comments'],
                     hintContent: order['orderId']+":"+order['address']
                    //iconContent: "Азербайджан"
                },
                {
                      hasHint: true,
                    hideIconOnBalloonOpen: false
                    // iconImageOffset: [-3, -42]
                }
            );
            pm.events.add('click', function () {
                //allocatedCollection.options.set('preset', 'islands#blueIcon');

                //e.get('target').options.set('preset', 'islands#yellowCircleDotIcon');
                $('#orderControl').show();
                $('#controlOrderId').text(order['orderId']);
                $('#controlOrderAddress').text(order['address']);
                $('#controlOrderComments').text(order['comments']);

                //pm.hint.show();
                //console.log(order['orderId']);
                //alert('О, событие!');
                // e.stopPropagation();
            });
            var addPm = allocatedCollection.add(pm);
            var index = addPm.get('index');
           // console.log(index);
            myMap.geoObjects.add(allocatedCollection);

        }
    );
}
/**
 * ставит точку, не попавшую в зону
 * @param order
 */
function setPointNotAllocated(order)
{
    var myGeocoder = ymaps.geocode(order['address']);
    myGeocoder.then(
        function (res) {

            var coords = res.geoObjects.get(0).geometry.getCoordinates()
            var pm = new ymaps.Placemark(
                coords, {
                    balloonContent: order['comments'],
                    hintContent: order['orderId']+":"+order['address']
                    //  hintContent: order['orderId']
                    //iconContent: "Азербайджан"
                },
                {
                    hasHint: false,
                    hideIconOnBalloonOpen: false
                    // iconImageOffset: [-3, -42]
                }
            );
            pm.events.add('click', function (e) {
                //allocatedCollection.options.set('preset', 'islands#blueIcon');
                e.get('target').options.set('preset', 'islands#yellowCircleDotIcon');
                $('#orderControl').show();
                $('#controlOrderId').text(order['orderId']);
                $('#controlOrderAddress').text(order['address']);
                //pm.hint.show();
                //console.log(order['orderId']);
                //alert('О, событие!');
                // e.stopPropagation();
            });
            notAllocatedCollection.add(pm);
            myMap.geoObjects.add(notAllocatedCollection);
            //notAllocatedCollection.
        }
    );
}

/**
 * добавляет элмент с данными распределённого заказа в итоговый блок страницы
 * @param zoneId id блока, соответствубщий зоне
 * @param order объект (заказ)
 */
function appendOrderToList(zoneId,order)
{
    var address = order['address'];
    var orderId = order['orderId'];
    //console.log('appen address:'+ address);
    $('#zone'+zoneId+' div.ordersAllocated ol').append('<li class="order">'+'<span class="label label-default orderId">'+orderId+'</span><span class="address">'+address+'</span></li>');
    // элемент списка (заказ)
    //var orderItem = $('li#'+orderId);
    // сощдаём скрытое поле с id заказа для последующей обработки при создании листа
    var inputOrderId = document.createElement("input");
    inputOrderId.setAttribute('type','hidden');
    inputOrderId.setAttribute('name','orderId[]');
    inputOrderId.setAttribute('value',orderId);

    //orderItem.append(inputOrderId);

    //кнопка удалить из распределения
    var btnRemoveFromAllocation = document.createElement("button");
    btnRemoveFromAllocation.setAttribute('class','btn btn-danger btn-sm removeAllocation');
    btnRemoveFromAllocation.setAttribute('type','button');
    btnRemoveFromAllocation.appendChild(document.createTextNode('X'));

    // группка дествиий по переносу в дргуие зоны

    //orderItem.append(btnRemoveFromAllocation);
   // orderItem.append(' ');

   var dropDownDiv = document.createElement("div");
    dropDownDiv.setAttribute('class','btn-group');

    var dropDownButton =  document.createElement("button");
    dropDownButton.setAttribute('class','btn btn-primary dropdown-toggle');
    dropDownButton.setAttribute('type','button');
    dropDownButton.setAttribute('data-toggle','dropdown');
    dropDownButton.setAttribute('aria-expanded','false');

    dropDownButton.appendChild(document.createTextNode('перенос'));
    var caret = document.createElement("span");
    caret.setAttribute('class','caret');
    dropDownButton.appendChild(caret);
    //var dropDownDivHeader = '<button type="button" class="btn btn-primary dropdown-toggle" data-toggle="dropdown" aria-expanded="false"> Перенос<span class="caret"></span></button>';

    dropDownDiv.appendChild(dropDownButton);

    var dropDownList = document.createElement("ul");
    dropDownList.setAttribute('class','dropdown-menu');
    dropDownList.setAttribute('role','menu');

    //console.log(dropDownDiv);

    var i;
    for (i = 1; i <= 6; i++) {

        if(i !== zoneId)
        {
            var item = document.createElement("li");
            item.setAttribute('class','transferToZone');
            var link = document.createElement("a");
            link.setAttribute('class','zone'+i);
            link.setAttribute('href','#');
            link.appendChild(document.createTextNode('зона '+i));
            item.appendChild(link);
            dropDownList.appendChild(item);

        }
    }
    dropDownDiv.appendChild(dropDownList);
    dropDownDiv.appendChild(dropDownList);
    //orderItem.append(dropDownDiv);

}

/**
 * добавляет заказ в нераспределённые при автораспределении заказов
 * @param order
 */
PetsAdmin.deliveryLocation.appendOrderToNotAllocated = function(order)
{
    var address = order['address'];
    var orderId = order['orderId'];
    var target = $('#notAllocated');
    target.find('div.ordersAllocated ol').append('<li id="'+orderId+'">'+'<span class="label label-default">'+orderId+'</span> '+address+'</li>');

    var orderItem = $('li#'+orderId);

    // сощдаём скрытое поле с id заказа для последующей обработки при создании листа
    var inputOrderId = document.createElement("input");
    inputOrderId.setAttribute('type','hidden');
    inputOrderId.setAttribute('name','orderId[]');
    inputOrderId.setAttribute('value',orderId);

    orderItem.append(inputOrderId);

    orderItem.append(' ');

    //кнопка удалить из распределения
    var btnRemoveFromAllocation = document.createElement("button");
    btnRemoveFromAllocation.setAttribute('class','btn btn-danger btn-sm removeAllocation');
    btnRemoveFromAllocation.setAttribute('type','button');
    btnRemoveFromAllocation.appendChild(document.createTextNode('X'));

    // группка дествиий по переносу в дргуие зоны

   // orderItem.append(btnRemoveFromAllocation);
   // orderItem.append(' ');

    var dropDownDiv = document.createElement("div");
    dropDownDiv.setAttribute('class','btn-group');
   // console.log(dropDownDiv);

    var dropDownButton =  document.createElement("button");
    dropDownButton.setAttribute('class','btn btn-primary dropdown-toggle');
    dropDownButton.setAttribute('type','button');
    dropDownButton.setAttribute('data-toggle','dropdown');
    dropDownButton.setAttribute('aria-expanded','false');

    dropDownButton.appendChild(document.createTextNode('перенос'));
    var caret = document.createElement("span");
    caret.setAttribute('class','caret');
    dropDownButton.appendChild(caret);
    //var dropDownDivHeader = '<button type="button" class="btn btn-primary dropdown-toggle" data-toggle="dropdown" aria-expanded="false"> Перенос<span class="caret"></span></button>';

    dropDownDiv.appendChild(dropDownButton);

    var dropDownList = document.createElement("ul");
    dropDownList.setAttribute('class','dropdown-menu');
    dropDownList.setAttribute('role','menu');

   // console.log(dropDownDiv);

    var i;
    for (i = 1; i <= 6; i++) {

            var item = document.createElement("li");
        item.setAttribute('class','allocateToZone');
            var link = document.createElement("a");
            link.setAttribute('href','#');
            link.appendChild(document.createTextNode('зона '+i));
            link.setAttribute('class','zone'+i);
            item.appendChild(link);
            dropDownList.appendChild(item);

    }
    dropDownDiv.appendChild(dropDownList);
    dropDownDiv.appendChild(dropDownList);
    //orderItem.append(dropDownDiv);
};

/**
 * собирает массив из выбранных заказов для распределения
 */
PetsAdmin.deliveryLocation.getOrdersForAllocation = function(){

    var orders = [];
    var target =  $('#select_orders_for_allocation_table');
    var selectedItems = target.find('tr td.check input:checked');
    console.log('len: ' + selectedItems.length);

    selectedItems.each(function () {
        var order_item = $(this).parent().parent();
        var order_id = order_item.attr('data-id');
        console.log(order_id);
        var address = order_item.find('span.address').text();
        var comments = order_item.find('td.comments').text();
        console.log(address);
        console.log(comments);
        orders.push(
            {
                orderId:  order_id,
                address: address,
                comments: comments

            });

    });
    return orders;
};


/**
 * подсчитывает число заказоа, выбранных для распределения
 *
 * @return int
 */
PetsAdmin.deliveryLocation.countOrdersForAllocation = function(){

    return PetsAdmin.deliveryLocation.getOrdersForAllocation().length;
};
/**
 * выполняет распределение заказов по зонам на карте
 */
PetsAdmin.deliveryLocation.allocate = function()
{
    var allocation_buttons =  $('li.allocation_buttons');
    var status_filters = $('#status_filters');
    var selection_area = $('#selection_area');
    var allocation_area = $('#allocation_area');
    selection_area.hide();
    allocation_area.show();
    allocation_buttons.hide();
    status_filters.hide();

    PetsAdmin.deliveryLocation.init();

};

/**
 * обновлеяет состояния и счётчики в кнопоках управления выделением заказов и распределением
 *
 */
PetsAdmin.deliveryLocation.updateAllocationButtons = function(){

    var orders_count = PetsAdmin.deliveryLocation.countOrdersForAllocation();
    var btn_allocate_selected =  $('#btn_allocate_selected_orders');
    var btn_save_selected =  $('#btn_save_selected_orders');
    var btn_reset_selected_orders =  $('#btn_reset_selected_orders');


  //  var saved_orders_count = data.orders.length;

  //  console.log('saved orders count: ' + saved_orders_count);
   // var btn_do_allocation =  $('#btnGetAllocation');

    if(orders_count > 0)
    {
        btn_allocate_selected.prop('disabled', false);
        btn_save_selected.prop('disabled', false);
        btn_reset_selected_orders.prop('disabled', false);
    }
    else
    {
        btn_allocate_selected.prop('disabled', true);
        btn_save_selected.prop('disabled', true);
        btn_reset_selected_orders.prop('disabled', true);
    }

    btn_allocate_selected.find('span.count').text(orders_count);
};


/**
 * обновляет состояние кнопки "удалить сохранённые" (заказы)
 */
PetsAdmin.deliveryLocation.updateRemoveButton = function(count)
{
    var btn_remove_saved_orders =  $('#btn_remove_saved_orders');

    if(count > 0)
    {
        btn_remove_saved_orders.prop('disabled', false);
        btn_remove_saved_orders.find('span.count').text(count);
    }
    else
    {
        btn_remove_saved_orders.prop('disabled', true);
        btn_remove_saved_orders.find('span.count').text(count);

    }
};
/**
 * Обновляет список неназначенных заказов
 */
PetsAdmin.deliveryLocation.updateUnassignedList = function(){


};
/**
 * создаёт список из неназначенных заказов
 * (добавдяет элементы в DOM в сущесвтующий путосй список)
 */
PetsAdmin.deliveryLocation.createUnassignedList = function(){

    var target_block = $('#unassignedContent');
    var target_list = target_block.find('ol');

    var orders = PetsAdmin.deliveryLocation.getOrdersForAllocation();

    orders.forEach( function(object){

        target_list.append('<li class="unassigned" data-id="'+object['orderId'] + '"><span class="label label-warning unallocatedLabel">'+ object['orderId']+ '</span>' +
            '<span class="address">'+  object['address']+'</span>' + '<span class="comments">'+  object['comments']+'</span>' + '</li>');
    });
};

/**
 * переключает статуст чекбокса при нажатии на номер заказа
 */

PetsAdmin.deliveryLocation.toggleOrderSelection = function(){

  var order_item = $(this).parent().parent().parent();
    var checkbox = order_item.find('td.check input');
    var checked = checkbox.prop("checked");
   // if(checkbox.attr('checked'))
    if(checked)
    {
//        checkbox.removeAttr('checked');
        checkbox.prop('checked',false);
        //checkbox.attr( "checked", 'false');
    }
    else
    {
        //checkbox.attr('checked', 'checked');
        checkbox.prop('checked', true);
    }

    PetsAdmin.deliveryLocation.updateAllocationButtons();
};

/**
 * снимает выделение со всех выбранные заказов
 */
PetsAdmin.deliveryLocation.resetOrderSelection = function(){

    var target =  $('#select_orders_for_allocation_table');
    var selectedItems = target.find('tr td.check input:checked');
    selectedItems.prop('checked',false);

    PetsAdmin.deliveryLocation.updateAllocationButtons();

};

/**
 * переключает чекбокс по нажатия ярлыка-фильтра статусов
 */
PetsAdmin.deliveryLocation.toggleStatusFilters = function(){

    var status = $(this).attr('data-id');
    //console.log(status);

    var checkbox = $('.status_filter[value="'+status +'"]');
    var checked = checkbox.prop("checked");
    if(checked)
    {
//        checkbox.removeAttr('checked');
        checkbox.prop('checked',false);
        //checkbox.attr( "checked", 'false');
    }
    else
    {
        //checkbox.attr('checked', 'checked');
        checkbox.prop('checked', true);
    }

  PetsAdmin.deliveryLocation.applyStatusFilters();

};

/**
 * смотрим на фильтры статусов заказов и применяет их к видимости заказов
 */
PetsAdmin.deliveryLocation.applyStatusFilters = function()
{

    var checkedCheckboxes = $('input.status_filter:checked');

    console.log(checkedCheckboxes.length);
    //если хотя бы один чекбокс выбран
    PetsAdmin.deliveryLocation.showAllOrders();

    if(checkedCheckboxes.length > 0)
    {
        checkedCheckboxes.each(function(){

           // console.log($(this));
            var status = $(this).val();
          //  console.log(status);

           var rows = $('#select_orders_for_allocation_table tr.order[data-status="'+status+'"]');
            rows.each(function(){

                if(!$(this).hasClass('filtered'))
                {
                    $(this).addClass('filtered');
                }
            });


        });

      $('tr.order').hide();
      $('tr.filtered').show();

    }



};
/**
 * показывает все заказы
 */
PetsAdmin.deliveryLocation.showAllOrders = function(){

    var rows = $('#select_orders_for_allocation_table tr.order').removeClass('filtered').show();

};

/**
 * созраняет в базе выбранные заказы (чтобы они не слетали при обновлении)
 */
PetsAdmin.deliveryLocation.saveOrderSelection = function(){

var orders = PetsAdmin.deliveryLocation.getOrdersForAllocation();

    var save_button = $(this);

    var orders_ids = [];
    orders.forEach(
        function(object){

            orders_ids.push(object['orderId']);
        }
    );
    var orders_json = JSON.stringify(orders_ids);
    //console.log('json: '+orders_ids);

    var debug = $('#debug');
    var request = $.ajax({
        type: 'post',
        data:
        {
            orders : orders_json
          //  test: 1
        },
        dataType: "json",
        url: "actionSaveOrders.php",
        error: function debugReport(jqXHR){
            console.log(jqXHR.status);
            console.log(jqXHR.statusText);
            console.log(jqXHR.responseText);
            console.log('Error connecting server or getting server response!');
        },
        beforeSend: function loader() {
            save_button.prop('disabled',true);
            save_button.removeClass('btn-success');
            save_button.addClass('btn-warning');

        },
        complete: function hideLoader() {
            save_button.removeClass('btn-warning');
            save_button.addClass('btn-success');


        }
    });
    request.done(function (data) {

        if(data.status == 'ok')
        {
            var saved_count = data.saved_count;
            PetsAdmin.deliveryLocation.updateRemoveButton(saved_count);
        }
    });
};

/**
 * удаляет все созранённые заказы для
 */
PetsAdmin.deliveryLocation.removeSavedOrders = function(){

    var remove_button = $(this);

    var debug = $('#debug');
    var request = $.ajax({
        type: 'post',
        data:
        {

        },
        //contentType: false,
        processData: false,
        dataType: "json",
        url: "actionRemoveSavedOrders.php",
        error: function debugReport(jqXHR){
            console.log(jqXHR.status);
            console.log(jqXHR.statusText);
            console.log(jqXHR.responseText);
            console.log('Error connecting server or getting server response!');
        },
        beforeSend: function loader() {
           // remove_button.prop('disabled',true);
            remove_button.removeClass('btn-danger');
            remove_button.addClass('btn-warning');

        },
        complete: function hideLoader() {
            remove_button.removeClass('btn-warning');
            remove_button.addClass('btn-danger');

        }
    });
    request.done(function (data) {
       // console.log(data.status);
        if(data.status == 'ok')
        {
            //console.log('passed');
            PetsAdmin.deliveryLocation.updateRemoveButton(0);
        }
    });

};
/**
 * получает id заказаов, сохранённых при распределении
 */
PetsAdmin.deliveryLocation.getSavedOrders = function(){

    var debug = $('#debug');

    var request = $.ajax({
        type: 'post',
        data:
        {

        },
       // contentType: false,
        processData: false,
        dataType: 'json',
        url: "actionGetSavedOrders.php",
        error: function debugReport(jqXHR){
            console.log(jqXHR.status);
            console.log(jqXHR.statusText);
            console.log(jqXHR.responseText);
            console.log('Error connecting server or getting server response!');
        },
        beforeSend: function loader() {
        },
        complete: function hideLoader() {
        }
    });

    request.done(function (data) {
        console.log(data.status);
        if(data.status == 'ok')
        {
            var saved_count  = data.orders.length;

            PetsAdmin.deliveryLocation.checkSavedOrders(data);
            PetsAdmin.deliveryLocation.updateAllocationButtons();
            PetsAdmin.deliveryLocation.updateRemoveButton(saved_count);
        }
    });
};
/**
 * отмечает заказы для распределения, сохранённые в базе
 * (после перезагрузки страницы они остаются отмеченными)
 */
PetsAdmin.deliveryLocation.checkSavedOrders = function(data){

    var orders = data.orders;

    var target_table = $('#select_orders_for_allocation_table');

        orders.forEach(function(order_id) {

        //console.log(order_id);
        var order_item = target_table.find('tr[data-id="'+order_id+'"]');
        console.log(order_item);
        var checkbox = order_item.find('td.check input');
        checkbox.prop('checked', true);

    });

};


/**
 * выделяет группу зказов, если удержан shift
 */
PetsAdmin.deliveryLocation.shiftSelect = function(){

 /*   if(start > end) {
        var temp = start;
        start = end;
        end = temp;
    };

    $('.chcktbl').eq(start).nextUntil(':eq('+(end+1)+')').add().prop('checked', true);
    countSelected();*/
};
/**
 * скроллит окно в начало области распределения
 */
PetsAdmin.deliveryLocation.scrollToTop = function(){
    $('html, body').animate({
        scrollTop: $("#top_header").offset().top
    }, 2000);
};


$(function() {

    $('.tablesorted').tablesorter();

    PetsAdmin.deliveryLocation.hideAllocationArea();

    PetsAdmin.deliveryLocation.getSavedOrders();

    $(document).on('click', '#select_orders_for_allocation_table td.check', PetsAdmin.deliveryLocation.updateAllocationButtons);

    $(document).on('click', '#btn_allocate_selected_orders',function(){

//собираем выбранные заказы
        var ordersItems = PetsAdmin.deliveryLocation.getOrdersForAllocation();

        if(ordersItems.length > 0){
            PetsAdmin.deliveryLocation.allocate();
        }

    });

    $(document).on('click', '#btnReload', PetsAdmin.deliveryLocation.reload);

    $(document).on('click', '.courierHeader',  PetsAdmin.deliveryLocation.toggleCourier);
    // действие при нажатии заголовка неназначенных заказов
    $(document).on('click', '#unassignedHeader', PetsAdmin.deliveryLocation.toggleUnassigned);
    $(document).on('click', '.allocatedHeader', PetsAdmin.deliveryLocation.toggleAssigned);
    $(document).on('click', '#btnCloseOrderControl',PetsAdmin.deliveryLocation.closeOrderWindow);
    //$(document).on('click', '#btnCollapseAssigned',PetsAdmin.deliveryLocation.collapseCouriersWindows);
    $(document).on('click', '#unassignedContent li span.unallocatedLabel', PetsAdmin.deliveryLocation.getUnassignedOrderDetails);
    $(document).on('click','.btnSetZoneToCourier', PetsAdmin.deliveryLocation.assignOrdersFromZoneToCourier);
    $(document).on('click','#btnSetOrderToCourier', PetsAdmin.deliveryLocation.assignOrderToCourier);
    $(document).on('submit', '.frmCreateList', PetsAdmin.deliveryLocation.createList);
    $(document).on('click','.order_id', PetsAdmin.deliveryLocation.toggleOrderSelection);
    $(document).on('click','#btn_reset_selected_orders', PetsAdmin.deliveryLocation.resetOrderSelection);
    $(document).on('click','#btn_save_selected_orders', PetsAdmin.deliveryLocation.saveOrderSelection);
    $(document).on('click','#btn_remove_saved_orders', PetsAdmin.deliveryLocation.removeSavedOrders);
    $(document).on('click','.status_filer_selector', PetsAdmin.deliveryLocation.toggleStatusFilters);
    $(document).on('change','.status_filter', PetsAdmin.deliveryLocation.applyStatusFilters);



});
