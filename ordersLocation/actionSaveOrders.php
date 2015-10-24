<?php
/**
 * Created by PhpStorm.
 * User: sergio
 * Date: 14.08.15
 * Time: 0:44
 */

require('../config/yii2.php');

require(__DIR__ . '/../../../vendor/autoload.php');
require(__DIR__ . '/../../../vendor/yiisoft/yii2/Yii.php');

new yii\web\Application($config);

$request = Yii::$app->request;
$session = Yii::$app->session;

$orderIdsJson = $request->post('orders');

$saved_count = 0;

$orderIds = json_decode($orderIdsJson);

if(!empty($orderIds))
{

    foreach($orderIds as $orderId)
    {

        $exists = (new \yii\db\Query())
            ->from('orders_for_allocation')
            ->where([
                'order_id'=>$orderId,
                'admin_user_id'=>$session->get('userid'),
            ])
            ->one();

        if(empty($exists))
        {

            $saved_count += $saveSelectedOrder = Yii::$app->db->createCommand()->insert('orders_for_allocation', [
                'order_id' => $orderId,
                'admin_user_id' => $session->get('userid'),

            ])->execute();
        }
    }

    $saved_count = (new \yii\db\Query())
        ->from('orders_for_allocation')
        ->where([
            'admin_user_id'=>$session->get('userid'),
        ])
        ->count();

    $status = 'ok';
}
else{
    $status = 'err';
}

$response = ['status' => $status,
    'saved_count' =>  $saved_count
];

echo json_encode($response);

