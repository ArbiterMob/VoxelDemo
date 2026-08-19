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
    camera.position.set(3.85, 3, 3.85);
    orbitControls.target.set(0, 1, 0);
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

    const group = new THREE.Group();
    const followGroup = new THREE.Group();
    scene.add(group);
    scene.add(followGroup);
    //#endregion

    //#region LIGHT, FOG
    const {light, ambientlight, lightHelper, shadowCameraHelper} = UTILS_GENERAL.createLight();
    
    light.shadow.camera.far = 25;

    followGroup.add(light);
    followGroup.add(light.target);
    scene.add(ambientlight);
    scene.add(lightHelper);
    scene.add(shadowCameraHelper);

    /*scene.background = new THREE.Color( 0x5e5d5d );
    const sceneFog = new THREE.Fog(0x5e5d5d, 0.1, 50);
    sceneFog.far = 24;
    scene.fog = sceneFog;*/
    //#endregion

    //#region MESH
    let controllableSkeleton, chest, hammer;
    //let floor;

    const gltfLoader = new GLTFLoader();
    gltfLoader.load('../../resources/skeleton.glb', (gltf) => {
        console.log(UTILS_GENERAL.dumpObject(gltf.scene).join('\n'));
    
        // default first skeletonw
        controllableSkeleton = UTILS_SKELETON.createSkeleton(scene, gltf.scene, gltf.animations, [0, 0, 0]);
        hammer = controllableSkeleton.root.getObjectByName('ps1_hammer002');
        hammer.visible = false;
        group.add(controllableSkeleton.root);
    });

    /*gltfLoader.load('../../resources/hammer.glb', (gltf) => {
        console.log(UTILS_GENERAL.dumpObject(gltf.scene).join('\n'));
        console.log(gltf.animations);

        hammer = UTILS_SKELETON.createHammer(scene, gltf.scene, gltf.animations, [0, 0, 0]);
        group.add(hammer.root);
    });*/

    gltfLoader.load('../../resources/chest.glb', (gltf) => {
        console.log(UTILS_GENERAL.dumpObject(gltf.scene).join('\n'));
        
        console.log(gltf.animations);
        chest = UTILS_SKELETON.createChest(scene, gltf.scene, gltf.animations, [4, 0, 6]);
    });

    gltfLoader.load('../../resources/floor.glb', (gltf) => {
        /*floor = */UTILS_PROCEDURAL.createCharacter(scene, gltf.scene, [0, 0, 0]);

        UTILS_PROCEDURAL.createCharacter(scene, gltf.scene, [-30, 0, 0]);
        UTILS_PROCEDURAL.createCharacter(scene, gltf.scene, [30, 0, 0]);
        UTILS_PROCEDURAL.createCharacter(scene, gltf.scene, [0, 0, -30]);
        UTILS_PROCEDURAL.createCharacter(scene, gltf.scene, [0, 0, +30]);
        UTILS_PROCEDURAL.createCharacter(scene, gltf.scene, [-30, 0, -30]);
        UTILS_PROCEDURAL.createCharacter(scene, gltf.scene, [+30, 0, +30]);
        UTILS_PROCEDURAL.createCharacter(scene, gltf.scene, [+30, 0, -30]);
        UTILS_PROCEDURAL.createCharacter(scene, gltf.scene, [-30, 0, +30]);
    });
    //#endregion

    //#region EVENTS
    const controlsThirdPerson = {
        keys: {
            'forward': false,
            'backward': false,
            'left': false,
            'right': false,
        },
        ease: new THREE.Vector3(),
        position: new THREE.Vector3(),
        up: new THREE.Vector3(0, 1, 0),
        rotate: new THREE.Quaternion(),
        current: 'Idle',
        fadeDuration: 0.5,
        //runVelocity: 5,
        walkVelocity: 1.8,
        rotateSpeed: 6,//0.05,
        floorDecale: 15,

        nextPosition: new THREE.Vector3(),
        actualMovement: new THREE.Vector3(),
    };
    
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    document.addEventListener('keypress', onKeyPress);
    
    function onKeyDown(event)
    {
        const keys = controlsThirdPerson.keys;
        switch (event.code)
        {
            case 'ArrowUp': case 'KeyW': keys.forward = true; break;
            case 'ArrowDown': case 'KeyS': keys.backward = true; break;
            case 'ArrowLeft': case 'KeyA': keys.left= true; break;
            case 'ArrowRight': case 'KeyD': keys.right = true; break;
        }
    }
    
    function onKeyUp(event)
    {
        const keys = controlsThirdPerson.keys;
        switch (event.code)
        {
            case 'ArrowUp': case 'KeyW': keys.forward = false; break;
            case 'ArrowDown': case 'KeyS': keys.backward = false; break;
            case 'ArrowLeft': case 'KeyA': keys.left= false; break;
            case 'ArrowRight': case 'KeyD': keys.right = false; break;
        }
    } 

    function onKeyPress(event)
    {
        if (event.code === 'KeyE')
        {
            /*console.log('%%%%%');
            console.log('KeyE', chest, controllableSkeleton);
            console.log(UTILS_GENERAL.calculateDistance(chest.root.position, group.position));
            console.log(chest.isOpen);*/

            if (chest.isOpen === false && UTILS_GENERAL.calculateDistance(chest.root.position, group.position) <= 1.8)
            {
                chest.isOpen = true;
                chest.openAction.reset();
                UTILS_SKELETON.setWeight(chest.openAction, 1);
                chest.openAction.play();

                hammer.visible = true;
            }
        }
    }
    
    function updateCharacter(delta)
    {
        const fade = controlsThirdPerson.fadeDuration;
        const keys = controlsThirdPerson.keys;
        const up = controlsThirdPerson.up;
        const ease = controlsThirdPerson.ease;
        const rotate = controlsThirdPerson.rotate;
        const position = controlsThirdPerson.position;
        const azimuth = orbitControls.getAzimuthalAngle();
        const nextPosition = controlsThirdPerson.nextPosition;
        const actualMovement = controlsThirdPerson.actualMovement;

        const vertical = - (Number(keys.forward) - Number(keys.backward));
        const horizontal = Number(keys.right) - Number(keys.left);
    
        //const active = !Object.values(keys).every((val) => val === false);
        const active = vertical !== 0 || horizontal !== 0;
        const play = active ? 'Walk' : 'Idle';
    
        // change animation
        if (controlsThirdPerson.current !== play)
        {
            const nextAction = controllableSkeleton.actions[play];
            const previousAction = controllableSkeleton.actions[controlsThirdPerson.current];
            controlsThirdPerson.current = play;
    
            /*current.reset();
            current.weight = 1.0;
            current.stopFading();
            old.stopFading();
            if (play !== 'Idle') current.time = old.time * (current.getClip().duration / old.getClip().duration);
            old._scheduleFading(fade, old.getEffectiveWeight(), 0);
            current._scheduleFading(fade, current.getEffectiveWeight(), 1);
            current.play();*/

            UTILS_SKELETON.prepareCrossFade(controllableSkeleton, previousAction, nextAction, fade, false);
        }
    
        // move object
        if (controlsThirdPerson.current !== 'Idle')
        {
            // run/walk velocity
            const velocity = controlsThirdPerson.walkVelocity;
    
            ease.set(horizontal, 0, vertical);
            if (ease.lengthSq() > 0)
                ease.normalize().multiplyScalar(velocity * delta);
    
            // calculate camera direction
            const angle = UTILS_GENERAL.unwrapRad(Math.atan2(ease.x, ease.z) + azimuth);
            rotate.setFromAxisAngle(up, angle);
    
            // apply camera angle on ease
            ease.applyAxisAngle(up, azimuth);
    
            nextPosition.copy(position).add(ease);
            nextPosition.x = THREE.MathUtils.clamp(nextPosition.x, -40, 40);
            nextPosition.z = THREE.MathUtils.clamp(nextPosition.z, -40, 40);
            actualMovement.subVectors(nextPosition, position);
    
            //position.add(ease);
            //camera.position.add(ease);
            position.copy(nextPosition);
            camera.position.add(actualMovement);
    
    
            group.position.copy(position);
            group.quaternion.rotateTowards(rotate, controlsThirdPerson.rotateSpeed * delta);
    
            orbitControls.target.copy(position).add({x: 0, y: 1, z: 0});
            followGroup.position.copy(position);
    
            // Move the floor without any limit
            /*if (floor.root)
            {
                const dx = (position.x - floor.root.position.x);
                const dz = (position.z - floor.root.position.z);
                if (Math.abs(dx) > controlsThirdPerson.floorDecale) floor.root.position.x += dx;
                if (Math.abs(dz) > controlsThirdPerson.floorDecale) floor.root.position.z += dz;
            }*/
        }
    
        controllableSkeleton.mixer.update(delta);
        orbitControls.update();
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

    function updateCamera() {
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

    /*const fogFolder = gui.addFolder('Fog');
    fogFolder.add(guiState, 'fog').name('Fog on').onChange((v) => {
        scene.fog = v ? sceneFog : null;
        scene.traverse((obj) => { if (obj.isMesh) obj.material.needsUpdate = true; });
    });
    const fogGUIHelper = new UTILS.FogGUIHelper(sceneFog, scene.background);
    fogFolder.add(fogGUIHelper, 'near', 1, 50).listen();
    fogFolder.add(fogGUIHelper, 'far', 1, 50).listen();
    fogFolder.addColor(fogGUIHelper, 'color');
    fogFolder.close();*/

    const bench = { fps: 0, drawCalls: 0, triangles: 0, geometries: 0 }
    const bf = gui.addFolder('Renderer stats')
    bf.add(bench, 'fps').listen().disable()
    bf.add(bench, 'drawCalls').name('draw calls').listen().disable()
    bf.add(bench, 'triangles').listen().disable()
    bf.add(bench, 'geometries').listen().disable()
    bf.open()
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

        if (controllableSkeleton)
            updateCharacter(delta);

        if (chest)
            chest.mixer.update(delta);

        //console.log(camera.position);

        orbitControls.update();
        stats.update();
        renderer.render(scene, camera);
        requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
    //#endregion
}

main();