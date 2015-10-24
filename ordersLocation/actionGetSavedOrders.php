<?php
/**
 * Created by PhpStorm.
 * User: sergio
 * Date: 14.08.15
 * Time: 12:57
 *
 * получает из базы сохранённые при распределении заказы для данного пользователя
 */

require('../config/yii2.php');

require(__DIR__ . '/../../../vendor/autoload.php');
require(__DIR__ . '/../../../vendor/yiisoft/yii2/Yii.php');

new yii\web\Application($config);

$session = Yii::$app->session;

$orders = (new \yii\db\Query())
    ->select('order_id as id')
    ->from('orders_for_allocation')
    ->where([
        'admin_user_id'=>$session->get('userid'),
    ])
    ->all();

$orders_ids = [];
$response = [];
if(!empty($orders))
{
    foreach($orders as $order)
    {
        $orders_ids[] = $order['id'];
    }
    $status = 'ok';

}
else{
    $status = 'empty';
}
$response['status'] = $status;
$response['orders'] = $orders_ids;
//var_dump($orders_ids);

//echo json_encode($orders_ids);
echo json_encode($response);