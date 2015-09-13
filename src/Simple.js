var CAN_ID   = 'glcanvas';  // canasid
var CAN_SIZE = 512;         // キャンバスサイズ
var fbuffer  = [];          // オフスクリーン用のバッファ
var ftexture = [];          // オフスクリーン用のテクスチャ
var program  = [];          // プログラムオブジェクト
var glCanvas = null;

// Live2D モデル設定。
var MODEL_PATH = "assets/Epsilon_free/";
var MODEL_DEFINE = {
    "type":"Live2D Model Setting",
    "name":"Epsilon_free",
    "model": MODEL_PATH + "Epsilon_free.moc",
    "textures":[
        MODEL_PATH + "/Epsilon_free.2048/texture_00.png",
    ],
    "motions":[
    	MODEL_PATH + "motions/Epsilon_free_idle_01.mtn",
    	MODEL_PATH + "motions/Epsilon_free_m_01.mtn",
    	MODEL_PATH + "motions/Epsilon_free_m_02.mtn",
    	MODEL_PATH + "motions/Epsilon_free_m_03.mtn",
    	MODEL_PATH + "motions/Epsilon_free_m_04.mtn",
    	MODEL_PATH + "motions/Epsilon_free_m_05.mtn",
    	MODEL_PATH + "motions/Epsilon_free_m_06.mtn",
    	MODEL_PATH + "motions/Epsilon_free_m_07.mtn",
    	MODEL_PATH + "motions/Epsilon_free_m_08.mtn",
    	MODEL_PATH + "motions/Epsilon_free_m_sp_01.mtn",
    	MODEL_PATH + "motions/Epsilon_free_m_sp_02.mtn",
    	MODEL_PATH + "motions/Epsilon_free_m_sp_03.mtn",
    	MODEL_PATH + "motions/Epsilon_free_m_sp_04.mtn",
    	MODEL_PATH + "motions/Epsilon_free_m_sp_05.mtn",
    	MODEL_PATH + "motions/Epsilon_free_shake_01.mtn",
    ],
    "drawid":[
        "D_CLOTHES.01", "D_BODY.00",
    ],
};

/*
 * ラジオボタン選択時、モザイクかける描画オブジェクトを変更する
 */
function radiochange(val){
    switch(val){
        case "obj1":
            MODEL_DEFINE.drawid = ["D_CLOTHES.01", "D_BODY.00"];
            break;
        case "obj2":
            MODEL_DEFINE.drawid = ["D_EYE.00", "D_EYE.01"];
            break;
        case "obj3":
            MODEL_DEFINE.drawid = ["D_ARM_R.02","D_ARM_L.02"];
            break;
        case "obj4":
            MODEL_DEFINE.drawid = ["D_CLOTHES.00", "D_FOOT.00", "D_FOOT.01"];
            break;
    }
}

/*
 * メイン処理
 */
window.onload = function(){
    glCanvas = new Simple();
}

var Simple = function() {
    // Live2Dモデルのインスタンス
    this.live2DModel = null;
    // アニメーションを停止するためのID
    this.requestID = null;
    // モデルのロードが完了したら true
    this.loadLive2DCompleted = false;
    // モデルの初期化が完了したら true
    this.initLive2DCompleted = false;
    // WebGL Image型オブジェクトの配列
    this.loadedImages = [];
    // モーション
    this.motions = [];
    // モーション管理マネジャー
    this.motionMgr = null;
    // モーション番号
    this.motionnm = 0;
    // モーションチェンジ
    this.motionchange = false;
    // Live2D モデル設定。
    this.modelDef = MODEL_DEFINE;

    // Live2Dの初期化
    Live2D.init();

    // canvasオブジェクトを取得
    this.can = document.getElementById(CAN_ID);
    this.can.width = this.can.height = CAN_SIZE;

    // コンテキストを失ったとき
    this.can.addEventListener("webglcontextlost", function(e) {
        console.error("context lost");
        this.loadLive2DCompleted = false;
        this.initLive2DCompleted = false;

        var cancelAnimationFrame =
            window.cancelAnimationFrame ||
            window.mozCancelAnimationFrame;
        cancelAnimationFrame(this.requestID); //アニメーションを停止

        e.preventDefault();
    }, false);

    // コンテキストが復元されたとき
    this.can.addEventListener("webglcontextrestored" , function(e){
        console.error("webglcontext restored");
        this.initLoop(can);
    }, false);

    // Init and start Loop
    this.initLoop(this.can);
};

/*
* WebGLコンテキストを取得・初期化。
* Live2Dの初期化、描画ループを開始。
*/
Simple.prototype.initLoop = function(can/*HTML5 canvasオブジェクト*/)
{
    //------------ WebGLの初期化 ------------

    // WebGLのコンテキストを取得する
    var para = {
        premultipliedAlpha : true,
//        alpha : false
    };
    var gl = this.getWebGLContext(can, para);
    if (!gl) {
        console.error("Failed to create WebGL context.");
        return;
    }

    // 描画エリアを白でクリア
    gl.clearColor( 1.0 , 1.0 , 1.0 , 1.0 );

    // コールバック対策
    var that = this;

    //------------ Live2Dの初期化 ------------

    // mocファイルからLive2Dモデルのインスタンスを生成
    this.loadBytes(this.modelDef.model, function(buf){
        that.live2DModel = Live2DModelWebGL.loadModel(buf);
    });

    // テクスチャの読み込み
    var loadCount = 0;
    for(var i = 0; i < this.modelDef.textures.length; i++){
        (function ( tno ){// 即時関数で i の値を tno に固定する（onerror用)
            that.loadedImages[tno] = new Image();
            that.loadedImages[tno].src = that.modelDef.textures[tno];
            that.loadedImages[tno].onload = function(){
                if((++loadCount) == that.modelDef.textures.length) {
                    that.loadLive2DCompleted = true;//全て読み終わった
                }
            }
            that.loadedImages[tno].onerror = function() {
                console.error("Failed to load image : " + that.modelDef.textures[tno]);
            }
        })( i );
    }

    // モーションのロード
    for(var i = 0; i < this.modelDef.motions.length; i++){
        this.loadBytes(that.modelDef.motions[i], function(buf){
            that.motions.push(Live2DMotion.loadMotion(buf));
        });
    }
    // モーションマネジャーのインスタンス化
    this.motionMgr = new L2DMotionManager();

    // マウスクリックイベント
    this.can.addEventListener("click", function(e){
        that.motionchange = true;
        if(that.motions.length - 1  > that.motionnm){
            that.motionnm++;
        }else{
            that.motionnm = 0;
        }
    }, false);

    // フレームバッファ用の初期化処理
    this.Init_framebuffer(gl);
    // VBOとIBOの初期化処理
    this.off_pro = new Simple.shaderProperty(gl, that, this.off_prg, false, true);
    // 図形描画の初期化処理
    this.object_pro = new Simple.objectProperty(gl, this.object_prg);
    // エフェクト描画の初期化処理
    this.effect_pro = new Simple.shaderProperty(gl, that, this.effect_prg, false, false);
    // 最後はマルティテクスチャ用に第3引数をtrueにする
    this.final_pro = new Simple.shaderProperty(gl, that, this.final_prg, true, false);

    // 各種行列の生成と初期化
    this.m = new matIV();
    this.mMatrix   = this.m.identity(this.m.create());
    this.vMatrix   = this.m.identity(this.m.create());
    this.pMatrix   = this.m.identity(this.m.create());
    this.tmpMatrix = this.m.identity(this.m.create());
    this.mvpMatrix = this.m.identity(this.m.create());
    //------------ 描画ループ ------------

    (function tick() {
        that.draw(gl, that); // 1回分描画

        var requestAnimationFrame =
            window.requestAnimationFrame ||
            window.mozRequestAnimationFrame ||
            window.webkitRequestAnimationFrame ||
            window.msRequestAnimationFrame;
        that.requestID = requestAnimationFrame( tick , that.can );// 一定時間後に自身を呼び出す
    })();
};

Simple.prototype.draw = function(gl/*WebGLコンテキスト*/, that)
{
    // Live2D初期化
    if( ! that.live2DModel || ! that.loadLive2DCompleted )
        return; //ロードが完了していないので何もしないで返る

    // ロード完了後に初回のみ初期化する
    if( ! that.initLive2DCompleted ){
        that.initLive2DCompleted = true;

        // 画像からWebGLテクスチャを生成し、モデルに登録
        for( var i = 0; i < that.loadedImages.length; i++ ){
            //Image型オブジェクトからテクスチャを生成
            var texName = that.createTexture(gl, that.loadedImages[i]);
            that.live2DModel.setTexture(i, texName); //モデルにテクスチャをセット
        }

        // テクスチャの元画像の参照をクリア
        that.loadedImages = null;

        // OpenGLのコンテキストをセット
        that.live2DModel.setGL(gl);

        // 表示位置を指定するための行列を定義する
        var w = that.live2DModel.getCanvasWidth();
        var h = that.live2DModel.getCanvasHeight();
        var s = 2.0 / h;    // canvas座標を-1.0〜1.0になるように正規化
        var p = w / h;      // この計算でModelerのcanvasサイズを元に位置指定できる
        var matrix4x4 = [
         s, 0, 0, 0,
         0,-s, 0, 0,
         0, 0, 1, 0,
        -p, 1, 0, 1 ];
        that.live2DModel.setMatrix(matrix4x4);
    }

    // モーションが終了していたら再生する
    if(that.motionMgr.isFinished() || that.motionchange == true ){
        that.motionMgr.startMotion(that.motions[that.motionnm], 0);
        that.motionchange = false;
    }
    // モーション指定されていない場合は何も再生しない
    if(that.motionnm != null){
        // モーションパラメータの更新
        that.motionMgr.updateParam(that.live2DModel);
    }

//    // キャラクターのパラメータを適当に更新
//    var t = UtSystem.getTimeMSec() * 0.001 * 2 * Math.PI; //1秒ごとに2π(1周期)増える
//    var cycle = 3.0; //パラメータが一周する時間(秒)
//    // PARAM_ANGLE_Xのパラメータが[cycle]秒ごとに-30から30まで変化する
//    that.live2DModel.setParamFloat("PARAM_ANGLE_X", 30 * Math.sin(t/cycle));

    // ビュー×プロジェクション座標変換行列
    that.m.lookAt([0.0, 0.0, 2.5], [0, 0, 0], [0, 1, 0], that.vMatrix);
    that.m.perspective(45, CAN_SIZE / CAN_SIZE, 0.1, 100, that.pMatrix);
    that.m.multiply(that.pMatrix, that.vMatrix, that.tmpMatrix);


    //***** フレームバッファ0をバインドする *****//
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbuffer[0].framebuffer);
    gl.clearColor(1.0, 1.0, 1.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    // Live2Dモデルを更新して描画
    that.live2DModel.update(); // 現在のパラメータに合わせて頂点等を計算
    that.live2DModel.draw();   // 描画


    //***** フレームバッファ1のバインドする *****//
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbuffer[1].framebuffer);
    // canvasを初期化
    gl.clearColor(1.0, 1.0, 1.0, 0.0);
    // ステンシルバッファの初期化
    gl.clearStencil(0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
    // ステンシルテストを有効にする
    gl.enable(gl.STENCIL_TEST);
    //------------ マスクする円描画 ------------//
    // stencilFunc(定数, ref, mask)
    gl.stencilFunc(gl.ALWAYS, 1, ~0);
    // stencilOp(引数1:Stencil=NG
    //           引数2:Stencil=OK&depth=NG
    //           引数3:Stencil=OK&Depth=OK )
    gl.stencilOp(gl.KEEP, gl.REPLACE, gl.REPLACE);
    // シェーダー切り替え
    gl.useProgram(that.object_prg);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    // 図形の描画
    that.draw_object(gl, that.live2DModel, that);

    //------------ 表示する画像の描画 ------------//
    // フレームバッファのテクスチャをバインド
    gl.bindTexture(gl.TEXTURE_2D, ftexture[0]);
    // シェーダー切り替え
    gl.useProgram(that.off_prg);
    // VBOとIBOの登録
    that.set_attribute(gl, that.off_pro.VBOList, that.off_pro.attLocation, that.off_pro.attStride);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, that.off_pro.iIndex);
    // stencilFunc(定数, ref, mask)
    gl.stencilFunc(gl.EQUAL, 1, ~0);
    // stencilOp(引数1:Stencil=NG
    //           引数2:Stencil=OK&depth=NG
    //           引数3:Stencil=OK&Depth=OK )
    gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
    // モデル座標変換行列の生成
    that.m.identity(that.mMatrix);
    // 行列の掛け合わせ
    that.m.multiply(that.tmpMatrix, that.mMatrix, that.mvpMatrix);
    gl.uniformMatrix4fv(that.off_pro.uniLocation[0], false, that.mvpMatrix);
    // uniform変数にテクスチャを登録
    gl.uniform1i(that.off_pro.uniLocation[1], false);   // シェーダー反転するかどうか
    gl.uniform1i(that.off_pro.uniLocation[2], false);   // マルチテクスチャかどうか
    gl.uniform1i(that.off_pro.uniLocation[3], 0);
    // uniform変数の登録と描画
    gl.drawElements(gl.TRIANGLES, that.off_pro.index.length, gl.UNSIGNED_SHORT, 0);
    // ステンシルテストを無効にする
    gl.disable(gl.STENCIL_TEST);


    //***** フレームバッファ2をバインドする *****//
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbuffer[2].framebuffer);
    gl.clearColor(1.0, 1.0, 1.0, 0.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    // フレームバッファのテクスチャをバインド
    gl.bindTexture(gl.TEXTURE_2D, ftexture[1]);
    // シェーダー切り替え
    gl.useProgram(that.effect_prg);
    // VBOとIBOの登録
    that.set_attribute(gl, that.effect_pro.VBOList, that.effect_pro.attLocation, that.effect_pro.attStride);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, that.effect_pro.iIndex);
    // uniform変数にテクスチャを登録
    gl.uniform1i(that.effect_pro.uniLocation[1], false);    // シェーダー反転するかどうか
    gl.uniform1i(that.effect_pro.uniLocation[2], false);    // マルチテクスチャかどうか
    // モデル座標変換行列の生成
    that.m.identity(that.mMatrix);
    // 表示位置
    that.m.translate(that.mMatrix, [-0.01, -0.00, 0.0], that.mMatrix);
    // 拡大縮小
    that.m.scale(that.mMatrix, [1.1, 1.1, 0.0], that.mMatrix);
    // 行列の掛け合わせ
    that.m.multiply(that.tmpMatrix, that.mMatrix, that.mvpMatrix);
    gl.uniformMatrix4fv(that.effect_pro.uniLocation[0], false, that.mvpMatrix);
    // uniform変数の登録と描画
    gl.drawElements(gl.TRIANGLES, that.effect_pro.index.length, gl.UNSIGNED_SHORT, 0);


    //***** フレームバッファのバインドを解除 *****//
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    // シェーダー切り替え
    gl.useProgram(that.final_prg);
    // canvasを初期化
    gl.clearColor(1.0, 1.0, 1.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    // VBOとIBOの登録
    that.set_attribute(gl, that.final_pro.VBOList, that.final_pro.attLocation, that.final_pro.attStride);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, that.final_pro.iIndex);
    // モデル座標変換行列の生成
    that.m.identity(that.mMatrix);
    // 表示位置
    that.m.translate(that.mMatrix, [0.0, 0.02, 0.0], that.mMatrix);
    // 拡大縮小
    that.m.scale(that.mMatrix, [1.02, 1.02, 0.0], that.mMatrix);
    that.m.multiply(that.tmpMatrix, that.mMatrix, that.mvpMatrix);
    // uniform変数の登録と描画
    gl.uniformMatrix4fv(that.final_pro.uniLocation[0], false, that.mvpMatrix);
    // uniform変数にテクスチャを登録
    gl.uniform1i(that.final_pro.uniLocation[1], true);  // シェーダー反転するかどうか
    gl.uniform1i(that.final_pro.uniLocation[2], true);  // マルチテクスチャかどうか
    // フレームバッファのテクスチャをバインド
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, ftexture[0]);
    gl.uniform1i(that.final_pro.uniLocation[3], 0);     // テクスチャ0
    // ステンシルバッファとポストエフェクトかけたものをテクスチャに設定
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, ftexture[2]);
    gl.uniform1i(that.final_pro.uniLocation[4], 1);     // テクスチャ1
    gl.activeTexture(gl.TEXTURE0);
    gl.drawElements(gl.TRIANGLES, that.final_pro.index.length, gl.UNSIGNED_SHORT, 0);
};

/*
* WebGLのコンテキストを取得する
*/
Simple.prototype.getWebGLContext = function(can/*HTML5 canvasオブジェクト*/)
{
    var NAMES = [ "webgl" , "experimental-webgl" , "webkit-3d" , "moz-webgl"];

    var param = {
        alpha : true,
        premultipliedAlpha : true,
        stencil : true,
    };

    for( var i = 0; i < NAMES.length; i++ ){
        try{
            var ctx = can.getContext( NAMES[i], param );
            if( ctx ) return ctx;
        }
        catch(e){}
    }
    return null;
};


/*
* Image型オブジェクトからテクスチャを生成
*/
Simple.prototype.createTexture = function(gl/*WebGLコンテキスト*/, image/*WebGL Image*/)
{
    var texture = gl.createTexture(); //テクスチャオブジェクトを作成する
    if ( !texture ){
        console.warn("Failed to generate gl texture name.");
        return -1;
    }

    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 1);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);    //imageを上下反転
    gl.activeTexture( gl.TEXTURE0 );
    gl.bindTexture( gl.TEXTURE_2D , texture );
    gl.texImage2D( gl.TEXTURE_2D , 0 , gl.RGBA , gl.RGBA , gl.UNSIGNED_BYTE , image);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.bindTexture( gl.TEXTURE_2D , null );

    return texture;
};

/*
* ファイルをバイト配列としてロードする
*/
Simple.prototype.loadBytes = function(path , callback)
{
    var request = new XMLHttpRequest();
    request.open("GET", path , true);
    request.responseType = "arraybuffer";
    request.onload = function(){
        switch( request.status ){
        case 200:
            callback( request.response );
            break;
        default:
            console.error( "Failed to load (" + request.status + ") : " + path );
            break;
        }
    }
    request.send(null);
};


/*
* フレームバッファの初期化処理
*/
Simple.prototype.Init_framebuffer = function(gl)
{
    // 頂点シェーダとフラグメントシェーダの生成
    var off_v_shader = this.create_shader(gl, 'vs');
    var off_f_shader = this.create_shader(gl, 'fs');
    var object_v_shader = this.create_shader(gl, 'object_vs');
    var object_f_shader = this.create_shader(gl, 'object_fs');
    var effect_v_shader = this.create_shader(gl, 'effect_vs');
    var effect_f_shader = this.create_shader(gl, 'effect_fs');
    // プログラムオブジェクトの生成とリンク
    this.off_prg = this.create_program(gl, off_v_shader, off_f_shader, 0, true);
    this.object_prg = this.create_program(gl, object_v_shader, object_f_shader, 1, false);
    this.effect_prg = this.create_program(gl, effect_v_shader, effect_f_shader, 2, false);
    this.final_prg = this.create_program(gl, off_v_shader, off_f_shader, 3, false);
    // 深度テストを有効にする
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.clearDepth(1.0);
    // フレームバッファを生成
    fbuffer[0] = this.create_framebuffer(gl, CAN_SIZE, CAN_SIZE, 0, false);
    fbuffer[1] = this.create_framebuffer(gl, CAN_SIZE, CAN_SIZE, 1, true);
    fbuffer[2] = this.create_framebuffer(gl, CAN_SIZE, CAN_SIZE, 2, false);
    fbuffer[3] = this.create_framebuffer(gl, CAN_SIZE, CAN_SIZE, 3, false);
};

/*
* VBOとIBOの初期化処理
*/
Simple.shaderProperty = function(gl, that, prg, multi_tex, reversal)
{
    // attributeLocationを配列に取得
    this.attLocation = new Array();
    this.attLocation[0] = gl.getAttribLocation(prg, 'position');
    this.attLocation[1] = gl.getAttribLocation(prg, 'color');
    this.attLocation[2] = gl.getAttribLocation(prg, 'textureCoord');
    // attributeの要素数を配列に格納
    this.attStride = new Array();
    this.attStride[0] = 3;
    this.attStride[1] = 4;
    this.attStride[2] = 2;
    // 頂点の位置
    this.position = [
        -1.0,  1.0,  0.0,
         1.0,  1.0,  0.0,
        -1.0, -1.0,  0.0,
         1.0, -1.0,  0.0
    ];
    // 頂点色
    this.color = [
        1.0, 1.0, 1.0, 1.0,
        1.0, 1.0, 1.0, 1.0,
        1.0, 1.0, 1.0, 1.0,
        1.0, 1.0, 1.0, 1.0
    ];
    // テクスチャ座標
    this.textureCoord = [
        0.0, 0.0,
        1.0, 0.0,
        0.0, 1.0,
        1.0, 1.0
    ];
    // 頂点インデックス
    this.index = [
        0, 1, 2,
        3, 2, 1
    ];
    // VBOとIBOの生成
    this.vPosition     = that.create_vbo(gl, this.position);
    this.vColor        = that.create_vbo(gl, this.color);
    this.vTextureCoord = that.create_vbo(gl, this.textureCoord);
    this.VBOList      = [this.vPosition, this.vColor, this.vTextureCoord];
    this.iIndex        = that.create_ibo(gl, this.index);
    // VBOとIBOの登録
    that.set_attribute(gl, this.VBOList, this.attLocation, this.attStride);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.iIndex);
    // uniformLocationを配列に取得
    this.uniLocation = new Array();
    this.uniLocation[0]  = gl.getUniformLocation(prg, 'mvpMatrix');
    this.uniLocation[1] = gl.getUniformLocation(prg, 'reversal');

    if(multi_tex == true){
        this.uniLocation[2]  = gl.getUniformLocation(prg, 'multi_tex');
        this.uniLocation[3]  = gl.getUniformLocation(prg, 'texture0');
        this.uniLocation[4]  = gl.getUniformLocation(prg, 'texture1');
    }else{
        this.uniLocation[2]  = gl.getUniformLocation(prg, 'multi_tex');
        this.uniLocation[3]  = gl.getUniformLocation(prg, 'texture0');
    }
};

/*
 * 図形描画用
 */
Simple.objectProperty = function(gl, prg)
{
    // attributeLocationを配列に取得
    this.object_attLoc = gl.getAttribLocation(prg, 'position');
    // attributeの要素(xyzの3要素)
    this.object_attSt = 3;
    // 頂点データ（円）
    this.object_pos = [];
    // 頂点インデックス（円）
    this.object_ind = [];
};

/*
* シェーダーコンパイル
*/
Simple.prototype.create_shader = function(gl, id)
{
    // シェーダを格納する変数
    var shader;
    // HTMLからscriptタグへの参照を取得
    var scriptElement = document.getElementById(id);
    // scriptタグが存在しない場合は抜ける
    if(!scriptElement){return;}
    // scriptタグのtype属性をチェック
    switch(scriptElement.type){
        // 頂点シェーダの場合
        case 'x-shader/x-vertex':
            shader = gl.createShader(gl.VERTEX_SHADER);
            break;
        // フラグメントシェーダの場合
        case 'x-shader/x-fragment':
            shader = gl.createShader(gl.FRAGMENT_SHADER);
            break;
        default :
            return;
    }
    // 生成されたシェーダにソースを割り当てる
    gl.shaderSource(shader, scriptElement.text);
    // シェーダをコンパイルする
    gl.compileShader(shader);
    // シェーダが正しくコンパイルされたかチェック
    if(gl.getShaderParameter(shader, gl.COMPILE_STATUS)){
        // 成功していたらシェーダを返して終了
        return shader;
    }else{
        // 失敗していたらエラーログをアラートする
        alert(gl.getShaderInfoLog(shader));
    }
};

/*
 * プログラムオブジェクトを生成しシェーダをリンクする関数
 */
Simple.prototype.create_program = function(gl, vs, fs, index, link){
    // プログラムオブジェクトの生成
    program[index] = gl.createProgram();
    // プログラムオブジェクトにシェーダを割り当てる
    gl.attachShader(program[index], vs);
    gl.attachShader(program[index], fs);
    // シェーダをリンク
    gl.linkProgram(program[index]);
    // シェーダのリンクが正しく行なわれたかチェック
    if(gl.getProgramParameter(program[index], gl.LINK_STATUS)){
        if(link == true){
            // 成功していたらプログラムオブジェクトを有効にする
            gl.useProgram(program[index]);
        }
        // プログラムオブジェクトを返して終了
        return program[index];
    }else{
        // 失敗していたらエラーログをアラートする
        alert(gl.getProgramInfoLog(program[index]));
    }
};

/*
 * VBOを生成する関数
 */
Simple.prototype.create_vbo = function(gl, data){
    // バッファオブジェクトの生成
    var vbo = gl.createBuffer();
    // バッファをバインドする
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    // バッファにデータをセット
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
    // バッファのバインドを無効化
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    // 生成した VBO を返して終了
    return vbo;
};

/*
 * VBOをバインドし登録する関数
 */
Simple.prototype.set_attribute = function(gl, vbo, attL, attS){
    // 引数として受け取った配列を処理する
    for(var i in vbo){
        // バッファをバインドする
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo[i]);
        // attributeLocationを有効にする
        gl.enableVertexAttribArray(attL[i]);
        // attributeLocationを通知し登録する
        gl.vertexAttribPointer(attL[i], attS[i], gl.FLOAT, false, 0, 0);
    }
};

/*
 * IBOを生成する関数
 */
Simple.prototype.create_ibo = function(gl, data){
    // バッファオブジェクトの生成
    var ibo = gl.createBuffer();
    // バッファをバインドする
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    // バッファにデータをセット
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Int16Array(data), gl.STATIC_DRAW);
    // バッファのバインドを無効化
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
    // 生成したIBOを返して終了
    return ibo;
};

/*
 * フレームバッファを生成する
 */
Simple.prototype.create_framebuffer = function(gl, width, height, index, stencil){
    // フレームバッファオブジェクトの生成
    var framebuffer = gl.createFramebuffer();
    // フレームバッファをバインドする
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    // レンダーバッファオブジェクトの生成
    var depthrenderbuffer = gl.createRenderbuffer();
    // レンダーバッファをバインドする
    gl.bindRenderbuffer(gl.RENDERBUFFER, depthrenderbuffer);
    if(stencil == false){
        // レンダーバッファのフォーマット設定
        gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, width, height);
        // フレームバッファへの深度バッファの関連付ける
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depthrenderbuffer);
    }else{
        // レンダーバッファのフォーマット設定
        gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_STENCIL, width, height);
        // フレームバッファへの深度バッファの関連付ける
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT, gl.RENDERBUFFER, depthrenderbuffer);
    }

    // テクスチャオブジェクトの生成
    var frametexture = gl.createTexture();
    // テクスチャをバインドする
    gl.bindTexture(gl.TEXTURE_2D, frametexture);
    // テクスチャへイメージを適用
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    // テクスチャパラメーター
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    // フレームバッファにテクスチャを関連付ける
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, frametexture, 0);
    // テクスチャのバインドを無効化
    gl.bindTexture(gl.TEXTURE_2D, null);
    // レンダーバッファのバインドを無効化
    gl.bindRenderbuffer(gl.RENDERBUFFER, null);
    // フレームバッファのバインドを無効化
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    // 生成したテクスチャをグローバル変数に代入
    ftexture[index] = frametexture;
    // 返り値
    return {framebuffer: framebuffer, depthrenderbuffer: depthrenderbuffer, texture:ftexture[index]};
};

/*
 * 図形描画用の初期設定
 */
Simple.prototype.draw_object = function(gl, live2DModel, that){
    // 描画オブジェクトIDリスト
    var drawidlist = [];
    drawidlist = that.modelDef.drawid;
    // 指定した描画オブジェクトの数だけループ
    for(var i = 0; i < drawidlist.length; i++){
        // 頂点情報を取得(描画オブジェクトごとのID)
        var drawIndex = live2DModel.getDrawDataIndex(drawidlist[i]);
        // 頂点位置
        var points = live2DModel.getTransformedPoints(drawIndex);
        var w = live2DModel.getCanvasWidth();
        var h = live2DModel.getCanvasHeight();
        var p = w / h;  // ModelerのCanvas縦横サイズが違うもの対応
        var vertex_cnt = 0;
        // 初期化
        that.object_pro.object_pos = [];
        for (var j = 0; j < points.length; j+=2) {
            // Canvasの解像度位置で返されるので、WebGL用に-1.0〜1.0の値に正規化
            that.object_pro.object_pos[vertex_cnt]   = ((points[j] * 2.0 - w) / w) * p;
            that.object_pro.object_pos[vertex_cnt+1] = ((points[j + 1] * 2.0 - h) / h);
            that.object_pro.object_pos[vertex_cnt+2] = 0.0;
            vertex_cnt+=3;
        }

        // VBO生成
        var vbo = that.create_vbo(gl, that.object_pro.object_pos);
        // VBOバインド
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
        // atribute属性を有効
        gl.enableVertexAttribArray(that.object_pro.object_attLoc);
        // attribute属性を登録
        gl.vertexAttribPointer(that.object_pro.object_attLoc, that.object_pro.object_attSt, gl.FLOAT, false, 0, 0);
        // uniformLocationの取得
        var object_uniLoc = gl.getUniformLocation(that.object_prg, 'mvpMatrix');
        // モデル座標変換行列の生成
        that.m.identity(that.mMatrix);
        // 行列の掛け合わせ
        that.m.multiply(that.tmpMatrix, that.mMatrix, that.mvpMatrix);
        // uniformLocationへ座標変換行列を登録
        gl.uniformMatrix4fv(object_uniLoc, false, that.tmpMatrix);
        // モデル描画
        gl.drawArrays(gl.TRIANGLE_FAN, 0, that.object_pro.object_pos.length / 3);
    }
};
