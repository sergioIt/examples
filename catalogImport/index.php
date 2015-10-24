<?php
/**
 * Created by PhpStorm.
 * User: sergio
 * Date: 23.04.15
 * Time: 20:12
 * @author Sergey Vaisliev
 *
 * самый важный скрипт ипорта данных из 1с, должен запускаться периодечески по расписанию,
 * либо в зависимости от другого скрипта, проверяющего дату создания файлов импорта
 *
 * импортирует каталог товаров в базу через xml-файлы выгрузки из 1С: import.xml, offers.xml
 * эти два файла должны заливаться автоматически из 1с в папку admin2/uploads/1c_exchange_files
 *
 * import.xml - файл товаров. содержит категории товаров, свойства товаров и значения свойств,
 * сами товары  и их свойства со значениями. не у каждого свойства есть значение.
 * offers.xml - файл товарных предложений, соответствующих товарам. сожержит цены, размер упаковки, штрихкод
 *
 * основной файл-import.xml, offers-как бы добавочный, но в текущей логике основной перебор идёт по нему,
 * ч то сейчас мне видится неппрвильным
 * процесс импорта разбивается на 3 логические части: обработка категорий, свойств товаров,
 * и обработка товаров  (в т.чю перевязка со катеогриями и своствами)
 *
 * самое важное здесь - не запутаться с понятиями:
 * в 1с: товары и товарыные предложения
 * соответственно в логике 123pets: группы товаров и товары
 *
 * все дополнительные данные по товарам (картинки, описание,важно знать, seo-url, рейтинги,
 * отзывы) - относятся не к 1с,  а к cms,
 * поэтому импортируеются через базу битрикса в productsImagesImport/, productsRatingsImport, productsReviewImport,
 * productsAdditionalImport, updateProductsGroups
 * @todo объентить импорты данных из cms в один обработчик, проходящий по всем товарам базе
 *
 */
set_time_limit(600);
require('../includes/classes/Parser.php');
$parser = new Admin\Parser();

require('../config/yii2.php');
require(__DIR__ . '/../../../vendor/yiisoft/yii2/Yii.php'); //подключаем yii2 для удобных запросов к базе

new yii\web\Application($config);

$importFile = __DIR__ . '/../uploads/1c_exchange_files/import.xml';
$offersFile = __DIR__ . '/../uploads/1c_exchange_files/offers.xml';

if (file_exists($importFile) and file_exists($offersFile)) {
    // 1. парсим всё что нужно из файлов выгрузки каталога 1с
    $productsXML = $parser->CatalogImportXML($importFile); // товары (и их связь с катеогриями и характеристиками)
    $offers = $parser->CatalogOffersXML($offersFile); // товарые предложения
    $categoriesXML = $parser->CategoriesXML($importFile); // категории
    $characteristicsXML = $parser->CharacteristicsXML($importFile); // харакатеристики
    // ini_set('xdebug.var_display_max_depth', 6);
    // массив всех xml_id все категорий
    $rawCategoriesXML = $parser->RawCategoriesXml($importFile);
    $rawProductsGroupsXML = $parser->RawProductGroups($importFile);
    $rawOffersXML = $parser->RawOffersXml($offersFile);

    $containsChangesOnly = $parser->containsChangesOnly($offersFile);

    //var_dump($containsChangesOnly); die();

    ini_set('xdebug.var_display_max_children', 200);
    echo '<h4>1. processing characteristics: </h4>';
    foreach ($characteristicsXML as $charXML) //перебираем свойства из xml
    { // находим статус и id каждого свойста в базе
        $characteristic_db = (new \yii\db\Query())
            ->select(['status', 'id'])
            ->from('characteristics')
            ->where([
                'xml_id' => $charXML['xml_id']
            ])
            ->one();
        // если нашлась характеристика в базе, то проверяем соответствие значений характеристики между xml и базой
        if (is_array($characteristic_db) and count($characteristic_db)) {
            // только для тех свойств, по котрым предполагается делать фильтрацию на frontend
            if ((int)$characteristic_db['status'] !== 0) { // если в xml есть хотя бы одно значеие свойства
                if (! empty($charXML['values'])) {
                    foreach ($charXML['values'] as $charXMLValue) { // проверяем, есть ли такое значение в базе
                        $char_value_db = (new \yii\db\Query())
                            ->from('characteristics_values')
                            ->where([
                                'xml_id' => $charXMLValue['xml_id']
                            ])
                            ->one();
                        // если нет, то добавляем это значение
                        if (empty($char_value_db)) {
                            echo '-><span style="color: blue">add new characteristic value: ' .
                                $charXMLValue['value']  . '</span>';
                            echo $insert = Yii::$app->db->createCommand()->insert('characteristics_values', [
                                'value' => $charXMLValue['value'],
                                'xml_id' => $charXMLValue['xml_id'],
                                'char_id' => $characteristic_db['id']
                            ])
                                //->getRawSql();
                                ->execute();
                        }

                    }
                }

            }
        } // иначе-добавляем отсутствующую характеристику в базу, и все её значения
        else {
            echo '-><span style="color: blue">add new characteristic: </span>';
            echo $charXML['name'];
            $insert = Yii::$app->db->createCommand()->insert('characteristics', [
                'name' => $charXML['name'],
                'xml_id' => $charXML['xml_id'],
                'status' => 1,
            ])->execute();
            // получаем внутренний id только что добавленной характеристики
            $characteristic_id = Yii::$app->db->getLastInsertID();
            // если у характеристики есть значения, то добавляем все эти значения в базу
            if (! empty($charXML['values'])) {
                foreach ($charXML['values'] as $charXMLValue) { // проверяем, есть ли такое значение в базе
                    $char_value_db = (new \yii\db\Query())
                        ->from('characteristics_values')
                        ->where([
                            'xml_id' => $charXMLValue['xml_id']
                        ])
                        ->one();
                    // если нет, то добавляем это значение
                    if (empty($char_value_db)) {
                        echo '-><span style="color: blue">add new characteristic value: ' . $charXMLValue['value']  .
                            '</span>';
                        echo $insert = Yii::$app->db->createCommand()->insert('characteristics_values', [
                            'value' => $charXMLValue['value'],
                            'xml_id' => $charXMLValue['xml_id'],
                            'char_id' => $characteristic_id
                        ])
                            //->getRawSql();
                            ->execute();
                    }

                }
            }

        }

    }
    //die();
    //2. разбираемся с категориями и брэндами:
    echo '<h4>2. processing categories: </h4>';

    // собираем все XML_ID активных категорий в базе
    $allCategoriesDb = (new \yii\db\Query())
        ->select('1cid')
        ->from('categories')
        ->where(['status' => 1])
        ->all();
    $rawCategoriesDb = [];

    foreach($allCategoriesDb as $categoryDb){

        $rawCategoriesDb[] =$categoryDb['1cid'];
    }

    $rawCategoriesToDisable = array_diff($rawCategoriesDb,$rawCategoriesXML);

    // делаем неактивными категории, которые есть в базе, но нет в xml
    if(! empty($rawCategoriesToDisable)){

        $disableCategories = Yii::$app->db->createCommand()
            ->update('categories',
                [
                    'status' => 0,
                ],
                ['1cid' => $rawCategoriesToDisable]
            );

        if($disableCategories->execute() > 0){

            echo 'disable all categories ('.count($rawCategoriesToDisable).'), that not found in xml';
        }
    }

    if (is_array($categoriesXML) and count($categoriesXML) > 0) {
        // для каждой катеогрии 1-ого уровня
        foreach ($categoriesXML as $categoryXML) {
            //ищем катеогрию в базе
            $category_db = (new \yii\db\Query())
                ->select('id')
                ->from('categories')
                ->where([
                    '1cid' => $categoryXML['xml_id']
                ])->one();
            // var_dump($category_db);
            // если в базе налась такая катеогрия, то идём дальше-перебор подкатеогрий
            if (is_array($category_db) and count($category_db) > 0) {
                if (isset($categoryXML['subcategories']) and is_array($categoryXML['subcategories'])) {
                    //  var_dump($categoryXML);
                    foreach ($categoryXML['subcategories'] as $subcategoryXML) {
                        // var_dump($subcategoryXML);
                        //ищем (под)категорию в базе
                        $subcategory_db = (new \yii\db\Query())
                            ->select('id')
                            ->from('categories')
                            ->where([
                                '1cid' => $subcategoryXML['xml_id']
                            ])->one();
                        // если нашлась подкатеогрия, перебираем брэнды (катеогрии 3-его уровня)
                        if (is_array($subcategory_db) and count($subcategory_db) > 0) {
                            // var_dump($subcategory_db);
                            if (isset($subcategoryXML['brands']) and is_array($subcategoryXML['brands'])) {
                                foreach ($subcategoryXML['brands'] as $xml_id => $brandName) {
                                    // ищем брэнд в базе
                                    $category_brand_db = (new \yii\db\Query())
                                        ->select('id')
                                        ->from('categories')
                                        ->where([
                                            '1cid' => $xml_id
                                        ])->one();

                                    if (is_array($category_brand_db) and count($category_brand_db) > 0) {
                                        // var_dump($category_brand_db);
                                        $category_brand_db_update = Yii::$app->db->createCommand()
                                            ->update('categories',
                                                [
                                                    'title' => $brandName,
                                                    '1cid' => $xml_id,
                                                    'parent_id' => $subcategory_db['id'],
                                                ],
                                                'id =' . $category_brand_db['id']
                                            );
                                        //echo $category_brand_db_update->rawSql;
                                        if ($category_brand_db_update->execute() > 0) {
                                            echo '<span style="color: darkblue">-> update brand ' . $brandName .
                                                '</span>';
                                        }
                                    } else //иначе добавляем брэнд в базу
                                    {
                                        // сначала добавляем брэнд в таблицу брэндов (brands)
                                        $brand_db_insert = Yii::$app->db->createCommand()
                                            ->insert('brands',
                                                [
                                                    'title' => $brandName,
                                                ]
                                            );
                                        // если брэнд добавился, добавляем его как подкатегорию
                                        //и перевязываем с добавленным брэндом
                                        if ($brand_db_insert->execute() > 0) {
                                            echo '<br><span style="color: darkgreen"> add new brand ' . $brandName .
                                                '</span>';
                                            $brand_db_id = Yii::$app->db->getLastInsertID();
                                            $category_brand_db_insert = Yii::$app->db->createCommand()
                                                ->insert('categories',
                                                    [
                                                        'title' => $brandName,
                                                        '1cid' => $xml_id,
                                                        'parent_id' => $subcategory_db['id'],
                                                        'brand_id' => $brand_db_id,
                                                        'status' => 1
                                                    ]
                                                );

                                            if ($category_brand_db_insert->execute() > 0) {
                                              echo '<span style="color: darkgreen">->add new brand as category</span>';
                                            }

                                        }

                                    }

                                }
                            }
                        } else { // иначе добавляем подкатеогрию в базу
                            echo '<br><span style="color: darkgreen"> add new sub category: ' .
                                $subcategoryXML['name'] . '</span>';
                            $subcategory_db_insert = Yii::$app->db->createCommand()
                                ->insert('categories',
                                    [
                                        'title' => $subcategoryXML['name'],
                                        '1cid' => $subcategoryXML['xml_id'],
                                        'parent_id' => $category_db['id'],
                                        'brand_id' => 0,
                                    ]
                                );

                            //echo $subcategory_db_insert->rawSql;
                            $subcategory_db_insert->execute();
                        }
                    }

                }

            } else {

                echo '<span style="color: darkgreen"> add new category: ' . $categoryXML['name'] . '</span>';
                $category_db_insert = Yii::$app->db->createCommand()
                    ->insert('categories',
                        [
                            'name' => $categoryXML['name'],
                            'xml_id' => $categoryXML['xml_id'],
                            'parent_id' => 0,
                            'brand_id' => 0,
                        ]
                    );
                //echo $category_db_insert->rawSql;
                $category_db_insert->execute();
            }

        }

    }
    //die();
    // 3. ОБРАБОТКА ТОВАРОВ (и их связей с катеогриями, свойствами, предлоежниями)
    if (is_array($productsXML) and count($productsXML) > 0) {
        echo '<h4>3. processing products and offers: </h4>';
        $count_prod_db = (new \yii\db\Query())->from('products_groups')->count();
        echo '<h4>processing products import (XML: ' . count($productsXML) . ', db: ' . $count_prod_db . ')</h4>';

        // сначала находит те группы товаров, которые есть в базе, но нет в xml

        $allProductsGroupsDb = (new \yii\db\Query())
            ->select('xml_id')
            ->from('products_groups')
            ->where(['status' => 1])
            ->all();

        $rawProductsGroupsDb = [];

        foreach($allProductsGroupsDb as $groupDb){

            $rawProductsGroupsDb[] =$groupDb['xml_id'];
        }

        $productsGroupsToDisable = array_diff($rawProductsGroupsDb,$rawProductsGroupsXML);

        // если такие группы тваров нашлись, ставим им статус 0
        if(! empty($productsGroupsToDisable)){

            $disableProductsGroups = Yii::$app->db->createCommand()
                ->update('products_groups',
                    [
                        'status' => 0,
                    ],
                    ['xml_id' => $productsGroupsToDisable]
                );

            if($disableProductsGroups->execute() > 0){

                echo '<br> disable product groups ('.count($productsGroupsToDisable).'), that not found in xml';
            }
        }

        //находим те предложения товаров, которые есть в базе, но нет в xml

        $allOffersDb = (new \yii\db\Query())
            ->select('xml_id')
            ->from('products')
            ->where(['status' => 1])
            ->all();

        $rawOffersDb = [];

        foreach($allOffersDb as $offerDb){

            $rawOffersDb[] =$offerDb['xml_id'];
        }


        $offersToDisable = array_diff($rawOffersDb,$rawOffersXML);

        echo 'offers to disable';


        // если такие предложения товаров нашлись, ставим им статус 0
        if(! empty($offersToDisable)){

            $disableOffers = Yii::$app->db->createCommand()
                ->update('products',
                    [
                        'status' => 0,
                    ],
                    ['xml_id' => $offersToDisable]
                );

           if($disableOffers->execute() > 0){

                echo '<br> disable offers ('.count($offersToDisable).'), that not found in xml';
            }
        }

        foreach ($productsXML as $key => $productXML) {

            $product_add = false; // признак добавления товара в базу. если остаётся false после основных операций
            //с товаром, то значит это обновление существубешго товара в баще
            // и процедуры обработки категорий, свойств и предложение товара опираются на этот логический признак
            echo '<br>processing product ' . $key . ' (' . $productXML['xml_id'] . ')';

            //  сначала находим товар в базе по xml_id
            $product_db = (new \yii\db\Query())
                ->select(['id','xml_id'])
                ->from('products_groups')
                ->where([
                    'xml_id' => $productXML['xml_id']
                ])->one();
// если товар помечен на удаление - не тратим на него время, просто ставим статус 0 и переходим к следующему
            if ($productXML['status'] == 0) {
                echo '->product marked as deleted';
                if (is_array($product_db)) {
                    echo '->update product status=0, go to next product';
                    $product_db_update = Yii::$app->db->createCommand()
                        ->update('products_groups',
                            [
                                'status' => 0,
                                'updated' => time(),
                            ],
                            'id = ' . $product_db['id'])
                        ->execute();
                } else {
                    echo '->no such product in db, go to next product';
                }
                continue;
            }
            else{
                // иначе добавляем xml id в массив id принимающей стороны
                //$xmlProductGroupsXMLIds[] = $productXML['xml_id'];
            }


            // если товар в базе нашёлся, то это сценарий обновления товара
            if (is_array($product_db)) {
                echo '->update product in db';
                $productId = $product_db['id'];
                $product_db_update = Yii::$app->db->createCommand()
                    ->update('products_groups',
                        [
                            'name' => $productXML['name'],
                            'articul' => $productXML['articul'],
                            'status' => $productXML['status'],
                            'updated' => time(),
                        ],
                        'id = ' . $productId
                    );
                $product_db_update->execute();
                // добавляем xml id в массив id, которые есть в базе
                //$dbProductGroupsXMLIds[] = $product_db['xml_id'];

            } else // иначе-сценарий добавления товара в базу
            {
                $product_add = true;
                echo '-><span style="color: darkgreen">add product to db</span>';
                $product_db_insert = Yii::$app->db->createCommand()
                    ->insert('products_groups',
                        [
                            'xml_id' => $productXML['xml_id'],
                            'name' => $productXML['name'],
                            'articul' => $productXML['articul'],
                            'status' => $productXML['status'],
                            'created' => time(),
                        ]);
                // echo '<br>'.$product_db_insert->rawSql;
                $product_db_insert->execute();
                $productId = Yii::$app->db->getLastInsertID();
                // если в xml товар помечен как удалённый, то выводим это сообщение
                if ($productXML['status'] == 0) {
                    echo '->set product status 0 (deleted)';
                }
            }
            // разбираемся с категориями товара
            echo '->processing categories';

            // id катеогрий, которые принимаются из xml
            $categoryImportedIds = [];
            // id катеогрий, которые существуют в базе
            $categoryAcceptedIds = [];

            // далее -определяем 3 группы id категорий: которые нужно удалить, добавить и проапдейтить(пересечение)
            if (! empty($productXML['categories']))
                // 1. ищем в базе соответвстиве катеогрий тем, что указаны в xml
                foreach ($productXML['categories'] as $categoryXML) {
                    $categoryDb =
                        (new \yii\db\Query())
                            ->select('id')
                            //->from('products_groups_categories as pgcat')
                            ->from('categories as cat')
                            ->where([
                                'cat.1cid' => $categoryXML
                            ])->one();
                    // echo $categoryDb->createCommand()->rawSql;
                    //->one();
                    // если связи из xmk не ншлось в базе, то это кандидат на добавлние
                    if (! empty ($categoryDb)) {
                        $categoryImportedIds[] = $categoryDb['id'];
                    }

                }
            //2.  ищем в баще все связи товара и категорий, которые есть

            $productCategoriesDb =
                (new \yii\db\Query())
                    ->select('category_id')
                    ->from('products_groups_categories')
                    ->where([
                        'product_id' => $productId
                    ])->all();

            if (! empty ($productCategoriesDb)) {

                foreach ($productCategoriesDb as $productCategoryDb) {
                    $categoryAcceptedIds[] = $productCategoryDb['category_id'];

                }
            }
            // делим id товаров на 3 группы - remove, add, update
            //соответственно тому, что с ними нужно сделать в нашей базе
            $categoryRemoveIds = array_diff($categoryAcceptedIds, $categoryImportedIds);
            $categoryAddIds = array_diff($categoryImportedIds, $categoryAcceptedIds);
            $categoryUpdateIds = array_intersect($categoryAcceptedIds, $categoryImportedIds);

            if (! empty($categoryRemoveIds)) {
                $removeProductCat = Yii::$app->db->createCommand()
                    ->delete('products_groups_categories',
                        [
                            'category_id' => $categoryRemoveIds,
                            'product_id' => $productId,

                        ]
                    )->execute();
                echo '->remove category link';
            }
            if (! empty($categoryAddIds)) {
                foreach ($categoryAddIds as $catId) {
                    $addProductCat = Yii::$app->db->createCommand()
                        ->insert('products_groups_categories',
                            ['category_id' => $catId,
                                'product_id' => $productId,]
                        )->execute();
                    echo '->add category link';
                }

            }
            // разбираемся со свойствами товара
            echo '->processing characteristics';
            if (isset($productXML['characteristics']) && is_array($productXML['characteristics']) &&
                count($productXML['characteristics']) > 0) {
                // только для добавляемого товара
                if ($product_add) {
                    // для каждой характерики товрава в XML
                    foreach ($productXML['characteristics'] as $product_xml_char) {
                        // если указаны элементы массив свойства товара
                        if (array_key_exists('xml_id', $product_xml_char) && array_key_exists('value',
                                $product_xml_char)) {
                            // ищем внутренние id характеристик по xml id
                            $char_db = (new \yii\db\Query())
                                ->select(['id', 'name', 'status'])
                                ->from('characteristics')
                                ->where([
                                    'xml_id' => $product_xml_char['xml_id']
                                ])
                                ->one();
                            // если нашли характеристику в базе,и её статус не 0 (т.е. по ней предполагается фильтрация)
                            // то ищем далее id значениея характеристики
                            if (is_array($char_db)) {
                                // var_dump($char_db);
                                $char_db_id = $char_db['id'];
                                echo '->get char id ' . $char_db_id;

                                if ((int)$char_db['status'] !== 0) {
                                // если значение характеристики в xml сущестует (не null), то ищем это значение в базе
                                    if (isset($product_xml_char['value'])) {
                                        // var_dump($product_xml_char);
                                        $char_val_db = (new \yii\db\Query())
                                            ->select(['id'])
                                            ->from('characteristics_values')
                                            ->where([
                                                'xml_id' => $product_xml_char['value']
                                            ])
                                            ->one();
                          // если нашлось значение свойства в базе, то можно обновляеть/добавлять его связь с товаром
                                        if (is_array($char_val_db)) {
                                            $char_val_db_id = $char_val_db['id'];
                                            echo '->get char value: ' . $char_val_db_id;
                                        } else {
                                            echo '<span style="color: red">->can\'t get characteristic value ' .
                                                $product_xml_char['value'] . 'in db</span>';
                                            continue;
                                        }
                                    } // если значение характеристики нет, то
                                    else {
                                        $char_val_db_id = NULL;
                                    }
                                    // ищем в базе связь товара group_id со свойством $char_db['id']
                                    $product_char_db = (new \yii\db\Query())
                                        ->select(['id'])
                                        ->from('products_characteristics')
                                        ->where([
                                            'product_group_id' => (int)$productId,
                                            'char_id' => (int)$char_db['id'],
                                        ]);
                                    // echo  $product_char_db->createCommand()->rawSql;
                                    $product_char_db->one();
                                    // если такая запись есть, то обновляем её значение
                                    if (is_array($product_char_db)) {
                                        echo '->update characteristic id ' . $product_char_db['id'];
                                        /*    Yii::$app->db->createCommand()->update('products_characteristics',
                                                ['char_value_id' => $char_val_db_id],
                                                'id = '.$product_char_db['id'].'')
                                                ->execute();*/
                                    } // если нет, то добавляем
                                    else {
                                        echo '->add  characteristic ' . $char_db['name'];
                                        Yii::$app->db->createCommand()->insert('products_characteristics', [
                                            'product_group_id' => $productId,
                                            'char_id' => $char_db_id,
                                            'char_value_id' => $char_val_db_id,
                                        ])->execute();
                                    }
                                } else {
                                    echo '<span style="color: blue">->skip this char (status=0)</span>';
                                }
                            } else {
                                echo '<span style="color: red">->can\'t find characteristic in db (' .
                                    $product_xml_char['xml_id'] . ')</span>';
                            }
                        }
                    }
                }
            }
            // разбираемся с предложениями товара
            echo '->processing offers';
            $productOffers = [];
            // ищем предложения в группе товаров по xml_id
            foreach ($offers as $offer) {
                if ($offer['product_xml_id'] == $productXML['xml_id']) {
                  //  echo '->found offer ' . $offer['offer_xml_id'];
                    $productOffers[] = $offer;
                }
            }
            // если у товара нашлось хотя бы одно предложения (а оно должно найтись)
            // то делаем перебор этих предложений и update/insert в нашу базу
            if (! empty($productOffers)) {
              //  echo '->get offer from db';
                foreach ($productOffers as $productOffer) {
                    $offer_db = (new \yii\db\Query())
                        ->select('id')
                        ->from('products')
                        ->where(['xml_id' => $productOffer['offer_xml_id']])
                        ->one();
                    // если предложение нашлось в базе-обновляем его
                    if (is_array($offer_db)) {
                        echo '->update offer ' . $offer_db['id'];
                        $product_offer_db_update = Yii::$app->db->createCommand()
                            ->update('products',
                                [
                                    'name' => $productOffer['name'],
                                    'xml_id' => $productOffer['offer_xml_id'],
                                    'barcode' => $productOffer['barcode'],
                                    'weight' => $productOffer['weight'],
                                    'size' => $productOffer['size'],
                                    'color' => $productOffer['color'],
                                    'material' => $productOffer['material'],
                                    'volume' => $productOffer['volume'],
                                    'pack_quantity' => $productOffer['pack_quantity'],
                                    'price' => $productOffer['price'],
                                    'quantity' => $productOffer['quantity'],
                                    'status' => $productOffer['status'],
                                    'group_id' => $productId,
                                    'updated' => time(),
                                ],
                                'id = ' . $offer_db['id']
                            );
                        //echo $product_offer_db_update->rawSql;
                        $product_offer_db_update->execute();
                    } // если предложение не нашлось в базе-добавляем его
                    else {
                        echo '-><span style="color:darkgreen">add offer' . $productOffer['offer_xml_id'] . '</span>';
                        $product_offer_db_insert = Yii::$app->db->createCommand()
                            ->insert('products',
                                [
                                    'name' => $productOffer['name'],
                                    'xml_id' => $productOffer['offer_xml_id'],
                                    'barcode' => $productOffer['barcode'],
                                    'weight' => $productOffer['weight'],
                                    'size' => $productOffer['size'],
                                    'color' => $productOffer['color'],
                                    'material' => $productOffer['material'],
                                    'volume' => $productOffer['volume'],
                                    'pack_quantity' => $productOffer['pack_quantity'],
                                    'price' => $productOffer['price'],
                                    'quantity' => $productOffer['quantity'],
                                    'status' => $productOffer['status'],
                                    'updated' => time(),
                                    'group_id' => $productId,
                                ]
                            );
                        //echo $product_offer_db_insert->rawSql;
                        $product_offer_db_insert->execute();
                    }
                }
            } else {
                echo '<span style="color: darkred">->offers not found->set product status = 2</span>';
                // ставим особый статус этому товару (2), потом будем разибратсья с ними
                $product_db_update = Yii::$app->db->createCommand()
                    ->update('products_groups',
                        [
                            'status' => 2,
                            'updated' => time(),
                        ],
                        'id = ' . $productId
                    );
                $product_db_update->execute();
            }

        }
    }

} else {
    echo '<span style="color: red"> one of source xml file not found</span>';
}