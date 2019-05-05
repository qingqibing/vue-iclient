import WidgetViewModel from './WidgetViewModel';

/**
 * @class WebSceneViewModel
 * @description Scene viewModel.
 * @extends WidgetViewModel
 */
export default class WebSceneViewModel extends WidgetViewModel {
  constructor(target, serviceUrl,scanEffect) {
    super();
    this.scanEffect = scanEffect || {};
    this.serviceUrl = serviceUrl;
    this.sceneId = target;
    if (this.serviceUrl.indexOf('iserver') >= 0) {
      this.sceneUrl = this.serviceUrl;
      this.createScene();
    } else {
      this.getSceneInfo();
    }
  }
  getSceneInfo() {
    SuperMap.FetchRequest.get(this.serviceUrl + '.json')
      .then(response => {
        return response.json();
      })
      .then(result => {
        console.log(result);
        let { thumbnail, name, url, id } = result;
        this.sceneInfo = { thumbnail, name, url, id };
        // 检查是否公开or私有
        this.sceneUrl = url;
        this.checkPrivate(result);
      });
  }
  checkPrivate(result) {
    let { authorizeSetting, url, content } = result;
    if (!url) {
      this.sceneUrl = JSON.parse(content).layers[0].url;
    }
    let isPublic = false; // 默认私有
    authorizeSetting.map(item => {
      if (item.entityType === 'USER' && item.entityName === 'GUEST') {
        isPublic = true;
      }
    });
    if (!isPublic) {
      this.fire('sceneisprivate');
      return;
    }
    this.createScene();
  }
  getSceneParam() {
    let style = {
      height: '1080px',
      width: '1920px',
      left: '0px',
      top: '0px'
    };
    return {
      type: 'Scene',
      nls: 'scene',
      title: (this.sceneInfo && this.sceneInfo.name) || 'Scene',
      id: new Date().getTime(),
      sceneUrl: this.sceneUrl,
      position: null,
      fullScreen: true,
      scanEffect: {
        status: this.scanEffect.status || false, //是否为开启状态
        type: this.scanEffect.type || (this.scanEffect.status && 'circle') || 'noScan',
        centerPostion: null,
        _period: this.scanEffect.period || 2000,
        speed: this.scanEffect.speed || 500,
        color: null
      },
      style
    };
  }
  createScene() {
    let sceneParam = this.getSceneParam();
    let sceneUrl = sceneParam.sceneUrl;
    sceneUrl = sceneUrl.slice(0, sceneUrl.indexOf('/rest/realspace') + 15);
    this.sceneViewer = new Cesium.Viewer(this.sceneId, {
      infobox: false
    });
    this.fire('createsceneviewersucceeded');
    this.scene = this.sceneViewer.scene;
    this.scene.fxaa = true;
    this.scene.skyAtmosphere.show = false;
    let scene = this.scene;
    let promise = scene.open(sceneUrl);
    Cesium.when.all(promise, () => {
      let sc = scene.camera;
      scene.camera.setView({
        //设置三维笛卡尔坐标点
        destination: Cesium.Cartesian3(sc.position.x, sc.position.y, sc.position.z),
        orientation: {
          heading: sc.heading,
          pitch: sc.pitch,
          roll: sc.roll
        }
      });
      //捕获三维场景上的鼠标事件，用于高亮场景组件
      let handler = new Cesium.ScreenSpaceEventHandler(scene.canvas);
      handler.setInputAction(e => {
        sceneParam.positopn = new Cesium.Cartesian3(sc.position.x, sc.position.y, sc.position.z);
        this.heightLight = true;
        if (sceneParam.scanEffect.status) {
          // 获取鼠标屏幕坐标,并将其转化成笛卡尔坐标
          let position = e.position;
          let last = scene.pickPosition(position);
          this.scene.scanEffect.centerPostion = last; // 设置扫描中心点
          sceneParam.scanEffect.centerPostion = last;
          this.tooltipIsVisable = true; //关闭悬浮提示
        }
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
      //恢复状态时，恢复扫描效果,加赞三维场景比较卡，所以延迟2秒后再加载光线效果
      if (sceneParam.scanEffect.status) {
        setTimeout(() => {
          this.startScan(sceneParam.scanEffect.type);
        }, 3000);
      }
      this.sceneParam = sceneParam;
    });
  }
  startScan(type) {
    let sc = this.scene.camera;
    this.scene.scanEffect.show = false;
    this.scene.scanEffect.mode = type === 'line' ? Cesium.ScanEffectMode.LINE : Cesium.ScanEffectMode.CIRCLE;
    if (this.sceneParam.scanEffect.centerPostion) {
      this.scene.scanEffect.centerPostion = this.sceneParam.scanEffect.centerPostion;
    } else {
      this.sceneParam.scanEffect.centerPostion = new Cesium.Cartesian3(sc.position.x, sc.position.y, sc.position.z);
      this.scene.scanEffect.centerPostion = new Cesium.Cartesian3(sc.position.x, sc.position.y, sc.position.z);
    }
    this.scene.scanEffect.color = Cesium.Color.CORNFLOWERBLUE;
    this.scene.scanEffect._period = this.sceneParam.scanEffect._period;
    this.scene.scanEffect.speed = this.sceneParam.scanEffect.speed;
    this.scene.scanEffect.show = true;
  }
}