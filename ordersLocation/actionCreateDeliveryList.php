<?php
/**
 * Created by PhpStorm.
 * User: sergio
 * Date: 12.05.15
 * Time: 18:37
 *
 * проверяет данные формы и создаёт маршрутный лист
 * (запись листа в базе и привзяку к нему заказов)
 */

require('../config/yii2.php');

//подключаем yii2 для упрощения написания запросов
require(__DIR__ . '/../../../vendor/autoload.php');
require(__DIR__ . '/../../../vendor/yiisoft/yii2/Yii.php');

new yii\web\Application($config);

$loader = new Twig_Loader_Filesystem('template');
$twig = new Twig_Environment($loader);

/**
 * статус для распределённог заказа
 */
const STATUS_ALLOCATED = 3;

$request = Yii::$app->request;
$session = Yii::$app->session;

$courierId = $request->post('courierId');
$ordersId = $request->post('orderId');

if(isset($session['userid']))
{
    if((int)$courierId > 0 and count($ordersId) > 0)
    {
       $insert = Yii::$app->db->createCommand()->insert('delivery_list',
            ['status' => 0,
                'courier_id' => $courierId,
                'created' => time(),
                'updated' => time(),
                'admin_user_id' => $session['userid']
            ]);
        if($insert->execute() > 0)
        {
            $listId = Yii::$app->db->getLastInsertID();
            // обновляем статусы заказов, привязываем к ним id листа

            // записываем лог изменений стутаса заказа
            foreach($ordersId as $orderId)
            {
                $insert = Yii::$app->db->createCommand()->update('orders',
                    ['status' => STATUS_ALLOCATED,
                        'delivery_list_id'=>$listId
                    ],
                    ['id' => $orderId]
                )->execute();

                Yii::$app->db->createCommand()->insert('orders_status_updates', [
                    'status' => STATUS_ALLOCATED,
                    'order_id' => $orderId,
                    'admin_userid' => $session['userid'],
                    'updated' => time(),
                ])->execute();
            }

            $template = $twig->loadTemplate('createDeliveryListSuccess.twig');
            echo $template->render(array('listId'=> $listId));
        }

    }
    else{
        $template = $twig->loadTemplate('errorInputData.twig');
        echo $template->render(array('messages'=> $messages));
    }
}
