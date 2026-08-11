import * as THREE from 'three';
import * as UTILS from '../utils.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import Stats from "three/examples/jsm/libs/stats.module";
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
//import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

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
    //let skeletonHelper;
    
    const skeletons = [];
    //let mixer;
    //let idleAction, walkAction;
    let idleWeight, walkWeight;
    //let actions;
    
    const gltfLoader = new GLTFLoader();
    gltfLoader.load('../resources/skeleton.glb', (gltf) => {
        const root = gltf.scene;
        console.log(dumpObject(root).join('\n'));

        /*root.traverse((child) => {
            if (child.isMesh) 
            {
                child.castShadow = true;
                child.receiveShadow = true;
                if (!child.geometry.attributes.normal)
                {
                    child.geometry.computeVertexNormals();
                }
            }
        });
        
        scene.add(root);

        skeletonHelper = new THREE.SkeletonHelper(root.getObjectByName('rig'));
		skeletonHelper.visible = false;
		scene.add(skeletonHelper);

        const animations = gltf.animations;
        mixer = new THREE.AnimationMixer(root);
        idleAction = mixer.clipAction(animations[0]);
        walkAction = mixer.clipAction(animations[1]);
        actions = [idleAction, walkAction];*/

        for (let i = 0; i < 2; i++)
        {
            skeletons.push(createCharacter(root, gltf.animations, {x: i * 2, y: 0, z: 0}));
        } 

        //walkAction.play();
        activateAllActions();

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

    function createCharacter(sourceRoot, animations, position) {
        const character = SkeletonUtils.clone(sourceRoot);
        character.position.set(position.x, position.y, position.z);

        character.traverse((child) => {
            if (child.isMesh) 
            {
                child.castShadow = true;
                child.receiveShadow = true;
                if (!child.geometry.attributes.normal)
                {
                    child.geometry.computeVertexNormals();
                }
            }
        });

        scene.add(character);

        const characterMixer = new THREE.AnimationMixer(character);
        const idleAction = characterMixer.clipAction(animations[0]);
        const walkAction = characterMixer.clipAction(animations[1]);
        
        const skeletonHelper = new THREE.SkeletonHelper(character.getObjectByName('rig'));
        skeletonHelper.visible = false;
        scene.add(skeletonHelper);

        return {
            root: character,
            mixer: characterMixer,
            helper: skeletonHelper,
            idleAction,
            walkAction,
        }

    }

    const plane = new THREE.Mesh( new THREE.PlaneGeometry( 100, 100 ), new THREE.MeshPhongMaterial( { color: 0xcbcbcb, depthWrite: false } ) );
	plane.rotation.x = - Math.PI / 2;
	plane.receiveShadow = true;
	scene.add( plane );
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
    
    const gui = new GUI();
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
    const animationSettings = {
        'show skeleton': false,
        'from walk to idle': function() {
            skeletons.forEach(function (skel)
            {
                prepareCrossFade(skel, skel.walkAction, skel.idleAction, 1.0);
            });
        },
        'from idle to walk': function() {
            skeletons.forEach(function (skel)
            {
                prepareCrossFade(skel, skel.idleAction, skel.walkAction, 0.5);
            });
        },
        'use default duration': true,
        'set custom duration': 3.5,
        'modify idle weight': 1.0,
        'modify walk weight': 0.0,
        'modify time scale': 1.0,
    }
    
    const crossFadeControls = [];

    const animationFolder = gui.addFolder('Animation');
    const crossFadeFolder = animationFolder.addFolder('Crossfading');
    const blendWeightsFolder = animationFolder.addFolder('Blend Weights');

    animationFolder.add(animationSettings, 'show skeleton').onChange(function (visibility) {
        skeletons.forEach(function (skel)
        {
            skel.helper.visible = visibility;
        });
    });

    crossFadeControls.push(crossFadeFolder.add(animationSettings, 'from walk to idle'));
    crossFadeControls.push(crossFadeFolder.add(animationSettings, 'from idle to walk'));
    crossFadeFolder.add(animationSettings, 'use default duration');
    crossFadeFolder.add(animationSettings, 'set custom duration', 0, 10, 0.01);
    
    blendWeightsFolder.add(animationSettings, 'modify idle weight', 0.0, 1.0, 0.01).listen().onChange(function (weight) {
        skeletons.forEach(function (skel)
        {
            setWeight(skel.idleAction, weight);
        });
    });
    blendWeightsFolder.add(animationSettings, 'modify walk weight', 0.0, 1.0, 0.01).listen().onChange(function (weight) {
        skeletons.forEach(function (skel)
        {
            setWeight(skel.walkAction, weight);
        });
    });

    crossFadeFolder.close();
    blendWeightsFolder.close();
    animationFolder.close();

    function activateAllActions()
    {
        skeletons.forEach(function (skel)
        {
            setWeight(skel.idleAction, animationSettings['modify idle weight']);
            setWeight(skel.walkAction, animationSettings['modify walk weight']);

            skel.idleAction.play();
            skel.walkAction.play();
        });
    }

    function unPauseAllActions()
    {
        skeletons.forEach(function (skel)
        {
            skel.idleAction.paused = false;
            skel.walkAction.paused = false;
        });
    }

    function prepareCrossFade(skel, startAction, endAction, defaultDuration)
    {
        const duration = setCrossFadeDuration(defaultDuration);
        unPauseAllActions();

        if (startAction === skel.idleAction)
        {
            executeCrossFade(startAction, endAction, duration);
        }
        else 
        {
            synchronizeCrossFade(skel.mixer, startAction, endAction, duration);
        }
    } 

    function setCrossFadeDuration(defaultDuration)
    {
        if (animationSettings['use default duration'])
        {
            return defaultDuration;
        }
        else 
        {
            return animationSettings['set custom duration'];
        }
    }

    function synchronizeCrossFade(mixer, startAction, endAction, duration)
    {
        mixer.addEventListener('loop', (onLoopFinished));

        function onLoopFinished(event)
        {
            if (event.action === startAction)
            {
                mixer.removeEventListener('loop', onLoopFinished);
                executeCrossFade(startAction, endAction, duration);
            }
        }
    }

    function executeCrossFade(startAction, endAction, duration)
    {
        setWeight(endAction, 1);
        endAction.time = 0;
        startAction.crossFadeTo(endAction, duration, true);
    }

    function setWeight(action, weight)
    {
        action.enabled = true;
        action.setEffectiveTimeScale(1);
        action.setEffectiveWeight(weight);
    }

    function updateWeightSliders()
    {
        animationSettings['modify idle weight'] = idleWeight;
        animationSettings['modify walk weight'] = walkWeight;
    }

    function updateCrossFadeControls()
    {
        if (idleWeight === 1 && walkWeight === 0)
        {
            crossFadeControls[0].disable();
            crossFadeControls[1].enable();
        }

        if (idleWeight === 0 && walkWeight === 1)
        {
            crossFadeControls[0].enable();
            crossFadeControls[1].disable();
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

    function render() {

        timer.update();
        const time = performance.now();
        frameCount++;

        if (skeletons.length > 0)
        {
            const referenceSkeleton = skeletons[0];

            idleWeight = referenceSkeleton.idleAction.getEffectiveWeight();
            walkWeight = referenceSkeleton.walkAction.getEffectiveWeight();

            updateWeightSliders();
            updateCrossFadeControls();
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

        stats.update();
        renderer.render(scene, camera);
        
        requestAnimationFrame(render);
    }

    requestAnimationFrame(render);
    //#endregion
}

main();