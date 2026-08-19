import * as THREE from 'three';
import * as UTILS from '../../utils.js'
import * as UTILS_GENERAL from '../utilsGeneral.js';
import * as UTILS_SKELETON from '../utilsSkeleton.js';
import * as UTILS_PROCEDURAL from '../utilsProcedural.js';
import Stats from "three/examples/jsm/libs/stats.module";
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

function main()
{
    //#region RENDERER, CAMERA, SCENE
    const canvas = document.querySelector('#c');
    const {renderer, scene, camera, orbitControls} = UTILS_GENERAL.createScene(canvas);
    camera.position.set(7, 5, 10);
    orbitControls.maxPolarAngle = Math.PI / 2 - 0.05;
    orbitControls.update();

    const environmentLoader = new THREE.TextureLoader();
    environmentLoader.load('../../resources/sky-sea-march-08-2024.jpg', (environmentTexture) => {
        environmentTexture.mapping = THREE.EquirectangularReflectionMapping;
        environmentTexture.colorSpace = THREE.SRGBColorSpace;
        scene.background = environmentTexture;
        scene.environment = environmentTexture;
        scene.environmentIntensity = 1.25;
        scene.backgroundIntensity = 1.0;
    });
    //#endregion

    //#region LIGHT
    const {light, ambientlight, lightHelper, shadowCameraHelper} = UTILS_GENERAL.createLight();
    
    light.shadow.camera.far = 25;

    scene.add(light);
    scene.add(light.target);
    scene.add(ambientlight);
    scene.add(lightHelper);
    scene.add(shadowCameraHelper);
    //#endregion

    //#region MESH
    const skeletons = [];
    let rootSkel, animations;

    const generalAnimationSettings = {
        'add skeleton': () => {
            const skel = UTILS_SKELETON.createSkeleton(scene, rootSkel, animations, [Math.random() * 20 - 10, 0, Math.random() * 20 - 10]);
            skeletons.push(skel);
            addSkeletonFolder(skel);
        },
        'remove skeleton': () => {
            removeSkeletonFolder();
        },  
    };
    
    const gui = new GUI();
    
    const animationFolder = gui.addFolder('Animation');
    const animationRigFolder = animationFolder.addFolder('Rig');
    animationRigFolder.add(generalAnimationSettings, 'add skeleton');
    animationRigFolder.add(generalAnimationSettings, 'remove skeleton');
    animationRigFolder.close();
    animationFolder.open();

    const gltfLoader = new GLTFLoader();
    gltfLoader.load('../../resources/skeleton.glb', (gltf) => {
        rootSkel = gltf.scene;
        animations = gltf.animations
        console.log(UTILS_GENERAL.dumpObject(rootSkel).join('\n'));
    
        // default first skeleton
        skeletons.push(UTILS_SKELETON.createSkeleton(scene, rootSkel, animations, [0, 0, 0]));
        addSkeletonFolder(skeletons[0]);
    });

    gltfLoader.load('../../resources/floor.glb', (gltf) => {
        UTILS_PROCEDURAL.createCharacter(scene, gltf.scene, [0, 0, 0]);
    });
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

    function updateCamera() {
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
    const bf = gui.addFolder('Renderer stats')
    bf.add(bench, 'fps').listen().disable()
    bf.add(bench, 'drawCalls').name('draw calls').listen().disable()
    bf.add(bench, 'triangles').listen().disable()
    bf.add(bench, 'geometries').listen().disable()
    bf.open()
    //#endregion

    //#region GUI ANIMATION SKELETON
    function addSkeletonFolder(skel)
    {
        const skelFolder = animationRigFolder.addFolder(`Skeleton-${skeletons.length}`);
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
    
    function removeSkeletonFolder()
    {
        if (skeletons.length > 1)
        {
            const lastSkelFolder = animationRigFolder.folders[animationRigFolder.folders.length - 1];
            lastSkelFolder.destroy();
            
            const skel = skeletons.pop()
            scene.remove(skel.root);
        } 
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
    const stats = Stats();
    document.body.appendChild(stats.dom);

    let timer = new THREE.Timer()
    timer.connect(document);
    let frameCount   = 0;
    let fpsTimestamp = 0;

    function render()
    {
        timer.update();
        const elapsed = timer.getElapsed();
        const delta = timer.getDelta();
        frameCount++;

        if (UTILS_GENERAL.resizeRendererToDisplaySize(renderer))
        {
            const canvas = renderer.domElement;
            camera.aspect = canvas.clientWidth / canvas.clientHeight;
            camera.updateProjectionMatrix();
        }

        if (elapsed - fpsTimestamp >= 0.5) {
            bench.fps         = Math.round(frameCount * 2);
            bench.drawCalls   = renderer.info.render.calls;
            bench.triangles   = renderer.info.render.triangles;
            bench.geometries  = renderer.info.memory.geometries;
            frameCount        = 0;
            fpsTimestamp      = elapsed;
        }

        if (skeletons.length > 0)
        {
            skeletons.forEach((skel) =>
            {
                skel.idleWeight = skel.idleAction.getEffectiveWeight();
                skel.walkWeight = skel.walkAction.getEffectiveWeight();

                updateWeightSliders(skel);
                updateCrossFadeControls(skel);

                skel.mixer.update(delta);
            })
        }

        orbitControls.update();
        stats.update();
        renderer.render(scene, camera);
        requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
    //#endregion
}

main();