<?php
/**
 * Created by PhpStorm.
 * User: sergio
 * Date: 14.08.15
 * Time: 14:44
 *
 * удаляет все сохранённые при распредеелнии заказы для данного пользователя (администартора)
 */

require('../config/yii2.php');

require(__DIR__ . '/../../../vendor/autoload.php');
require(__DIR__ . '/../../../vendor/yiisoft/yii2/Yii.php');

new yii\web\Application($config);

$session = Yii::$app->session;

$deleteSavedOrders = Yii::$app->db->createCommand()->delete('orders_for_allocation',
    [
        'admin_user_id'=>$session->get('userid')
    ]
 );

if($deleteSavedOrders->execute() > 0)
{

    $status = 'ok';
}
else
{
    $status = 'err';
}

$response['status'] = $status;

echo json_encode($response);