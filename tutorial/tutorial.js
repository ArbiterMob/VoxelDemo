import * as THREE from 'three';
import * as UTILS from '../utils.js';
import * as UTILS_SKELETON from './utilsSkeleton.js';
import * as UTILS_PROCEDURAL from './utilsProcedural.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import Stats from "three/examples/jsm/libs/stats.module";
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
//import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

function main() 
{
    //#region RENDERER
    const canvas = document.querySelector("#c");
    const renderer = new THREE.WebGLRenderer({ antialias: true, canvas });
    renderer.shadowMap.enabled = true;
    //#endregion

    //#region CAMERA, SCENE
    const fov = 45;
    const aspect = 2;
    const near = 0.1;
    const far = 100;
    const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
    camera.position.set(2, 2, 2);

    const orbitControls = new OrbitControls(camera, canvas);
    orbitControls.target.set(0, 1, 0);
    orbitControls.update();

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('lightblue');
    //#endregion

    //#region LIGHT
    const intensity = 3;
    const light = new THREE.DirectionalLight(0xFFFFFF, intensity);
    light.position.set(15, 15, 10);
    light.target.position.set(0, 1, 0); // Point at the center of the world
    light.castShadow = true;
    
    light.shadow.camera.left = -10;
    light.shadow.camera.right = 10;
    light.shadow.camera.top = 10;
    light.shadow.camera.bottom = -10;
    light.shadow.camera.near = 1;
    light.shadow.camera.far = 30;
    light.shadow.mapSize.width = 2048;
    light.shadow.mapSize.height = 2048;
    
    light.shadow.bias = -0.0001;
    light.shadow.normalBias = 0.05;
    
    scene.add(light);
    scene.add(light.target);
    
    const ambientlight = new THREE.AmbientLight(0xFFFFFF, 0.35);
    scene.add(ambientlight);
    
    const lightHelper = new THREE.DirectionalLightHelper(light);
    lightHelper.visible = false;
    scene.add(lightHelper);
    const shadowCameraHelper = new THREE.CameraHelper(light.shadow.camera);
    shadowCameraHelper.visible = false;
    scene.add(shadowCameraHelper);
    //#endregion

    //#region LOAD GLB/GLTF, MESH    
    const skeletons = [], rats = [];
    let rootSkel, rootRat, animations;

    const generalAnimationSettings = {
        'add new skeleton': () => {
            const skel = UTILS_SKELETON.createCharacter(scene, rootSkel, animations, [Math.random() * 5 + 1, 0, Math.random() * 5 + 1]);
            skeletons.push(skel);
            addSkeletonFolder(skel);
        }
    }

    const gui = new GUI();

    const animationFolder = gui.addFolder('Animation');
    animationFolder.add(generalAnimationSettings, 'add new skeleton');
    animationFolder.close();
    
    const gltfLoader = new GLTFLoader();
    gltfLoader.load('../resources/skeleton.glb', (gltf) => {
        rootSkel = gltf.scene;
        animations = gltf.animations
        console.log(dumpObject(rootSkel).join('\n'));

        skeletons.push(UTILS_SKELETON.createCharacter(scene, rootSkel, animations, [0, 0, 0]));
        addSkeletonFolder(skeletons[0]);
    });

    gltfLoader.load('../resources/rat.glb', (gltf) => {
        rootRat = gltf.scene;
        console.log(dumpObject(rootRat).join('\n'));

        rats.push(UTILS_PROCEDURAL.createCharacter(scene, rootRat, [-1, 0, 0]));
    });
    
    function dumpObject(obj, lines = [], isLast = true, prefix = '')
    {
        const localPrefix = isLast ? '└─' : '├─';
        lines.push(`${prefix}${prefix ? localPrefix : ''}${obj.name || '*no-name*'} [${obj.type}]`);
        const newPrefix = prefix + (isLast ? '  ' : '| ');
        const lastNdx = obj.children.length - 1;
        obj.children.forEach((child, ndx) => {
            const isLast = ndx === lastNdx;
            dumpObject(child, lines, isLast, newPrefix);
        });
        return lines;
    }

    const plane = new THREE.Mesh( new THREE.PlaneGeometry( 100, 100 ), new THREE.MeshPhongMaterial( { color: 0xcbcbcb, depthWrite: false } ) );
	plane.rotation.x = - Math.PI / 2;
	plane.receiveShadow = true;
	scene.add( plane );

    // PATH
    let curveRat;
    let curveObjectRat;

    {
        const controlPoints = [
            [-2.000000, 0.000000, 0.000000],
            [-1.000000, 0.000000, 0.000000], 
            [0.000000, 0.000000, 0.000000],
            [1.000000, 0.000000, 0.000000],
            [2.000000, 0.000000, 0.000000],
            [2.000000, 0.000000, -3.000000],
            [-4.000000, 0.000000, -3.000000],
            [-4.000000, 0.000000, 2.000000],
            [-1.000000, 0.000000, 2.000000],
            [-1.000000, 0.000000, -6.000000],
            [3.000000, 0.000000, -6.000000],
            [3.000000, 0.000000, -8.000000],
            [-2.000000, 0.000000, -8.000000],
        ];

        const p0 = new THREE.Vector3();
        const p1 = new THREE.Vector3();
        curveRat = new THREE.CatmullRomCurve3(
            controlPoints.map((p, ndx) => {
                p0.set(...p);
                p1.set(...controlPoints[(ndx + 1) % controlPoints.length]);
                return [
                    (new THREE.Vector3()).copy(p0),
                    (new THREE.Vector3()).lerpVectors(p0, p1, 0.1),
                    (new THREE.Vector3()).lerpVectors(p0, p1, 0.9),
                ];
            }).flat(),
            true,
        );

        {
            const points = curveRat.getPoints(250);
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const material = new THREE.LineBasicMaterial({color: 0xff0000});
            curveObjectRat = new THREE.Line(geometry, material);
            curveObjectRat.position.set(-5, 0, 0);
            scene.add(curveObjectRat);
        }
    }
    //#endregion

    //#region GUI
    function updateLight()
    {
        light.target.updateMatrixWorld();
        lightHelper.update();
    
        light.shadow.camera.updateProjectionMatrix();
        shadowCameraHelper.update();
    }
    updateLight();
    
    function updateCamera()
    {
        camera.updateProjectionMatrix();
    }
    
    const guiState = { shadows: true, fog: true };

    const lightFolder = gui.addFolder('Light');
    lightFolder.add(lightHelper, 'visible').name('showHelper');
    lightFolder.addColor(new UTILS.ColorGUIHelper(light, 'color'), 'value').name('color');
    lightFolder.add(light, 'intensity', 0, 5, 0.01);
    UTILS.makeXYZGUI(lightFolder, light.position, 'position', updateLight);
    UTILS.makeXYZGUI(lightFolder, light.target.position, 'target', updateLight);
    lightFolder.close();
    
    const shadowFolder = lightFolder.addFolder('Shadow Camera');
    shadowFolder.add(shadowCameraHelper, 'visible').name('showHelper');
    shadowFolder.add(guiState, 'shadows').name('Shadows on').onChange((v) => {
        renderer.shadowMap.enabled = v;
        scene.traverse((obj) => { if (obj.isMesh) obj.material.needsUpdate = true; });
    });
    shadowFolder.add(new UTILS.DimensionGUIHelper(light.shadow.camera, 'left', 'right'), 'value', 1, 300)
        .name('width').onChange(updateLight);
    shadowFolder.add(new UTILS.DimensionGUIHelper(light.shadow.camera, 'bottom', 'top'), 'value', 1, 300)
        .name('height').onChange(updateLight);
    const shadowCameraMinMaxGUIHelper = new UTILS.MinMaxGUIHelper(light.shadow.camera, 'near', 'far', 0.1);
    shadowFolder.add(shadowCameraMinMaxGUIHelper, 'min', 0.1, 50, 0.1).name('near').onChange(updateLight);
    shadowFolder.add(shadowCameraMinMaxGUIHelper, 'max', 0.1, 1000, 0.1).name('far').onChange(updateLight);
    shadowFolder.add(light.shadow.camera, 'zoom', 0.01, 1.5, 0.01).onChange(updateLight);
    shadowFolder.close();

    const cameraFolder = gui.addFolder('Camera');
    const freeCameraFolder = cameraFolder.addFolder('Free Camera');
    const freeCameraMinMaxGUIHelper = new UTILS.MinMaxGUIHelper(camera, 'near', 'far', 0.1);
    freeCameraFolder.add(freeCameraMinMaxGUIHelper, 'min', 0.1, 50, 0.1).name('near').onChange(updateCamera);
    freeCameraFolder.add(freeCameraMinMaxGUIHelper, 'max', 0.1, 1000, 0.1).name('far').onChange(updateCamera);
    cameraFolder.close();

    const bench = { fps: 0, drawCalls: 0, triangles: 0, geometries: 0 }
    const bf    = gui.addFolder('Renderer stats')
    bf.add(bench, 'fps').listen().disable()
    bf.add(bench, 'drawCalls').name('draw calls').listen().disable()
    bf.add(bench, 'triangles').listen().disable()
    bf.add(bench, 'geometries').listen().disable()
    bf.open()
    //#endregion
    
    
    //#region GUI ANIMATION SKELETON
    function addSkeletonFolder(skel)
    {
        const skelFolder = animationFolder.addFolder(`Skeleton-${skeletons.length}`);
        const crossFadeFolder = skelFolder.addFolder('Crossfading');
        const blendWeightsFolder = skelFolder.addFolder('Blend Weights');

        skelFolder.add(skel.animationSettings, 'show skeleton').onChange((visibility) => skel.helper.visible = visibility);

        skel.crossFadeControls.push(crossFadeFolder.add(skel.animationSettings, 'from walk to idle'));
        skel.crossFadeControls.push(crossFadeFolder.add(skel.animationSettings, 'from idle to walk'));
        crossFadeFolder.add(skel.animationSettings, 'use default duration');
        crossFadeFolder.add(skel.animationSettings, 'set custom duration', 0, 10, 0.01);

        blendWeightsFolder.add(skel.animationSettings, 'modify idle weight', 0.0, 1.0, 0.01).listen().onChange((weight) => UTILS_SKELETON.setWeight(skel.idleAction, weight));
        blendWeightsFolder.add(skel.animationSettings, 'modify walk weight', 0.0, 1.0, 0.01).listen().onChange((weight) => UTILS_SKELETON.setWeight(skel.walkAction, weight));

        crossFadeFolder.open();
        blendWeightsFolder.open();
        skelFolder.close();
    }

    function updateWeightSliders(skel)
    {
        skel.animationSettings['modify idle weight'] = skel.idleWeight;
        skel.animationSettings['modify walk weight'] = skel.walkWeight;
    }

    function updateCrossFadeControls(skel)
    {
        if (skel.idleWeight === 1 && skel.walkWeight === 0)
        {
            skel.crossFadeControls[0].disable();
            skel.crossFadeControls[1].enable();
        }

        if (skel.idleWeight === 0 && skel.walkWeight === 1)
        {
            skel.crossFadeControls[0].enable();
            skel.crossFadeControls[1].disable();
        }
    }
    //#endregion

    //#region RENDER
    function resizeRendererToDisplaySize(renderer) {
        const canvas = renderer.domElement;
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;
    
        const needResize = canvas.width !== width || canvas.height !== height;
        if (needResize) {
            renderer.setSize(width, height, false);
        }
    
        return needResize;
    }
    
    const stats = Stats();
    document.body.appendChild(stats.dom);
    
    let frameCount   = 0;
    let fpsTimestamp = 0;
    let timer = new THREE.Timer()
    timer.connect(document);
    //let prevTime = performance.now();

    const ratPosition = new THREE.Vector3();
    const ratTarget = new THREE.Vector3();

    function render() {

        timer.update();
        const time = performance.now();
        frameCount++;

        if (skeletons.length > 0)
        {
            skeletons.forEach((skel) =>
            {
                skel.idleWeight = skel.idleAction.getEffectiveWeight();
                skel.walkWeight = skel.walkAction.getEffectiveWeight();

                updateWeightSliders(skel);
                updateCrossFadeControls(skel);
            })
        }

        if (resizeRendererToDisplaySize(renderer)) {
            const canvas = renderer.domElement;
            
            camera.aspect = canvas.clientWidth / canvas.clientHeight;
            camera.updateProjectionMatrix();

            //fpCamera.aspect = canvas.clientWidth / canvas.clientHeight;
            //fpCamera.updateProjectionMatrix();

            //composer.setSize(canvas.width, canvas.height);
        }

        if (time - fpsTimestamp >= 500) {
            bench.fps         = Math.round(frameCount * 2);
            bench.drawCalls   = renderer.info.render.calls;
            bench.triangles   = renderer.info.render.triangles;
            bench.geometries  = renderer.info.memory.geometries;
            frameCount        = 0;
            fpsTimestamp      = time;
        }

        //prevTime = time;

        let mixerUpdateDelta = timer.getDelta();

        for (const skeleton of skeletons)
        {
            skeleton.mixer.update(mixerUpdateDelta);
        }

        //#region PATH MOVEMENT
        if (rats.length > 0)
        {
            const pathTime = time * .00005;
            const targetOffset = 0.01;
            rats.forEach((rat, ndx) => {
                // a number between 0 and 1 to evenly space the rats
                const u = pathTime + ndx / rats.length;

                // get the first point
                curveRat.getPointAt(u % 1, ratPosition);
                ratPosition.applyMatrix4(curveObjectRat.matrixWorld);

                // get a second point slightly further down the curve
                curveRat.getPointAt((u + targetOffset) % 1, ratTarget);
                ratTarget.applyMatrix4(curveObjectRat.matrixWorld);

                // put the rat at the first point (temporarily)
                rat.root.position.copy(ratPosition);
                // point the rat to the second point
                rat.root.lookAt(ratTarget);

                // put the rat between the 2 points
                rat.root.position.lerpVectors(ratPosition, ratTarget, 0.5);
            });  
        }
        //#endregion

        stats.update();
        renderer.render(scene, camera);
        
        requestAnimationFrame(render);
    }

    requestAnimationFrame(render);
    //#endregion
}

main();