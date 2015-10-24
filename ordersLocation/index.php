<?php
/**
 * Created by PhpStorm.
 * User: sergio
 * Date: 08.05.15
 * Time: 17:34
 * распределяет заказы по зонам доставки
 */

require('../config/yii2.php');
require('../config/host.php');
require('../config/modules.php');

require(__DIR__ . '/../../../vendor/yiisoft/yii2/Yii.php');
require_once('../../../vendor/autoload.php');

new yii\web\Application($config);
/**
 * ограничение на вывод последних заказов дял распределения
 */
const ORDERS_FOR_LOCATION_LIMIT = 1500;

$session = Yii::$app->session;

if (! empty($session) and isset($session['group'])) {
    if ($session['group'] == 100 or $session['group'] == 300) {
        $selectFields = ['ord.id as orderId',
            'ord.status as status',
            'ord.bx_status as bx_status',
            'ord.paid',
            'ord.sum',
            'ord.origin',
            'ord.date_create as created',
            'ord.manager_comment',
            'ord.customer_comment',
            'ord.delivery_comment',
            'ord.stock_comment',
            'fail.name as delivery_fail_reason',
            'cont.user_id as userId',
            'cont.street as street',
            'cont.house as house',
            'cont.corp as corp',
            'cont.flat as flat',
            'cont.name as name',
            'cont.phone as phone',
            'cont.area as area',
            'cont.district as district',
        ];
        // какие заказы выбираем для распредеелния:
        $whereConditions = [
            //'delivery_list_id' => 0,  //заказ не должен принадлжать какому-либо листу, т.е. не должен быть распределён
            'delivery_method' => 0, //способ доставки - обычная доставка
            'origin' => 3 //пока что только импортированные из битрикса
        ];
        // все заказы, кроме успешно доставленных и распределённых
        $statusCondition = ['not in', 'ord.status', [3, 4, 7]];

        $query = (new \yii\db\Query())->select($selectFields)
            ->from('orders as ord')
            ->leftJoin('contacts as cont', 'ord.contact_id=cont.id')
            ->leftJoin('delivery_fail_reasons as fail', 'fail.id=ord.delivery_fail_reason_id')
            ->where($whereConditions);
        $query->andWhere($statusCondition);

        //echo $query->createCommand()->rawSql;
        $orders = $query->orderBy('orderId desc')->limit(ORDERS_FOR_LOCATION_LIMIT)->all();

        $couriers = (new \yii\db\Query())->select(
            ['id', 'name', 'status'])

            ->from('admin_users')
            ->where(['group' => 400])
            ->all();

        Twig_Autoloader::register();
        $zones = [1 => 'юго-восток', 2 => 'юго-запад', 3 => 'центр', 4 => 'восток', 5 => 'север', 6 => 'крайний север'];
        $loader = new Twig_Loader_Filesystem(['template']);
        $twig = new Twig_Environment($loader);
        $template = $twig->loadTemplate('index.twig');
        echo $template->render(array('catalog' => $catalog, 'session' => $session, 'modules' => $modules,
            'orders' => $orders, 'couriers' => $couriers, 'zones' => $zones));

    } else {
        header('Location:' . $actionsPath);
    }
} else {
    header('Location: ' . $actionsPath . 'login/');
}