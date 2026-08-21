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

    const characterInitialPosition = new THREE.Vector3(2, 0, 2);

    camera.position.set(-1.85, 3, -1.85);
    orbitControls.target.copy(characterInitialPosition).add({x: 0, y: 1, z: 0});
    orbitControls.maxPolarAngle = Math.PI / 2 - 0.05;
    orbitControls.minPolarAngle = 0.8;
    orbitControls.minDistance = 1;
    orbitControls.maxDistance = 5;
    orbitControls.update();

    scene.background = new THREE.Color('black');

    const group = new THREE.Group();
    group.position.copy(characterInitialPosition);
    const followGroup = new THREE.Group();
    scene.add(group);
    scene.add(followGroup);
    //#endregion

    //#region GUI
    const gui = new GUI();
    //const guiState = { shadows: true, fog: true };
    //const lightFolder = gui.addFolder('Light');
    //const shadowFolder = lightFolder.addFolder('Shadow Camera');

    /*function updateLight()
    {
        light.target.updateMatrixWorld();
        lightHelper.update();

        light.shadow.camera.updateProjectionMatrix();
        shadowCameraHelper.update();
    }*/
    //updateLight();

    function updateCamera() {
        camera.updateProjectionMatrix();
    }

    /*function createLightFolder()
    {
        lightHelper = new THREE.DirectionalLightHelper(light);
        lightHelper.visible = false;
        shadowCameraHelper = new THREE.CameraHelper(light.shadow.camera);
        shadowCameraHelper.visible = false;
        scene.add(lightHelper);
        scene.add(shadowCameraHelper);


        lightFolder.add(lightHelper, 'visible').name('showHelper');
        lightFolder.addColor(new UTILS.ColorGUIHelper(light, 'color'), 'value').name('color');
        lightFolder.add(light, 'intensity', 0, 5, 0.01);
        UTILS.makeXYZGUI(lightFolder, light.position, 'position', updateLight);
        UTILS.makeXYZGUI(lightFolder, light.target.position, 'target', updateLight);
        lightFolder.close();

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

        updateLight();
    }*/


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

    //#region SKELETON
    let controllableSkeleton, hammer;
    let usingHammer = false;

    const gltfLoader = new GLTFLoader();
    gltfLoader.load('../../resources/skeleton.glb', (gltf) => {
        console.log(UTILS_GENERAL.dumpObject(gltf.scene).join('\n'));
        console.log(gltf.animations);
    
        // default first skeleton
        controllableSkeleton = UTILS_SKELETON.createSkeleton(group, gltf.scene, gltf.animations, [0, 0, 0]);
        hammer = controllableSkeleton.root.getObjectByName('ps1_hammer002');
        hammer.visible = false;
        //group.add(controllableSkeleton.root);

        controllableSkeleton.mixer.addEventListener('finished', onSkeletonActionFinished);
    });

    function onSkeletonActionFinished(event)
    {
        const hammerAction = controllableSkeleton.actions['Hammer'];

        if (event.action !== hammerAction)
            return;
        
        const keys = controlsThirdPerson.keys;
        const vertical = - (Number(keys.forward) - Number(keys.backward));
        const horizontal = Number(keys.right) - Number(keys.left);

        const active = vertical !== 0 || horizontal !== 0;
        const play = active ? 'Walk' : 'Idle';
        const nextAction = controllableSkeleton.actions[play];

        controlsThirdPerson.current = play;
        UTILS_SKELETON.prepareCrossFade(controllableSkeleton, hammerAction, nextAction, controlsThirdPerson.fadeDuration, false);
        usingHammer = false;

        for (let i = 0; i < rats.length; i++)
        {
            const rat = rats[i];
            if(!rat.isDead && rat.root.position.distanceToSquared(group.position) <= 1.8 ** 2)
                {
                rat.isDead = true;
                rat.root.visible = false;
                console.log('killed a rat');
            }
        }
    }
    //#endregion

    //#region BATS, LIGHT
    /*let light, lightHelper, shadowCameraHelper;*/
    const bats = [], batRoots = [];

    const controlPointsBat = [
        [1.000000, 0.000000, 0.000000],
        [1.000000, 0.000000, 28.000000], 
        [13.000000, 0.000000, 28.000000],
        [13.000000, 0.000000, 14.000000],
        [28.000000, 0.000000, 14.000000],
        [28.000000, 0.000000, 28.000000],
        [28.000000, 0.000000, 28.000000],
        [15.000000, 0.000000, 28.000000],
        [15.000000, 0.000000, 0.000000],
        [28.000000, 0.000000, 0.000000],
        [28.000000, 0.000000, 13.000000],
        [2.000000, 0.000000, 13.000000],
        [2.000000, 0.000000, 0.000000],
        [13.000000, 0.000000, 0.000000],
        [13.000000, 0.000000, 12.000000],
        [3.000000, 0.000000, 12.000000],
        [3.000000, 0.000000, 0.000000],
        [1.000000, 0.000000, 0.000000],
    ];

    const curveBat = UTILS_PROCEDURAL.createCurve(controlPointsBat);

    gltfLoader.load('../../resources/bat.glb', (gltf) => {
        console.log(UTILS_GENERAL.dumpObject(gltf.scene).join('\n'));
        console.log(gltf.animations)

        const bat1 = UTILS_SKELETON.createBat(scene, gltf.scene, gltf.animations, [0, 0, 0]);
        bats.push(bat1);
        batRoots.push(bat1.root)

        const bat2 = UTILS_SKELETON.createBat(scene, gltf.scene, gltf.animations, [0, 0, 0]);
        bats.push(bat2);
        batRoots.push(bat2.root);

        /*light = bat.light;
        createLightFolder();*/
    });

    const ambientlight = new THREE.AmbientLight(0xFFFFFF, 0.7);
    scene.add(ambientlight);
    //#endregion

    //#region RAT
    const rats = [];
    const curveRatPosition = [
        [16, 0, 11],
        [3.57143, 0, 14.8571],
        [12, 0, 20.5],
        [24, 0, 10.5],
    ]
    const curveRatRotation = [
        [0, 0, 0],
        [0, - 0.5 * Math.PI, 0],
        [0, - Math.PI, 0],
        [0, - Math.PI, 0],
    ]

    const controlPointsRat = [
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

    const curveRat = UTILS_PROCEDURAL.createCurve(controlPointsRat);
    const curveRats = [];
    const curveRatObjects = [];

    gltfLoader.load('../../resources/rat.glb', (gltf) => {
        console.log(UTILS_GENERAL.dumpObject(gltf.scene).join('\n'));

        for (let i = 0; i < curveRatPosition.length; i++)
        {
            const rat = UTILS_PROCEDURAL.createCharacter(scene, gltf.scene, [0, 0, 0], true)
            rat.isDead = false;
            rats.push(rat);

            const curve = curveRat.curve.clone();
            const curveObject = curveRat.curveObject.clone();
            curveObject.position.set(...curveRatPosition[i]);
            curveObject.rotation.set(...curveRatRotation[i]);

            curveRats.push(curve);
            curveRatObjects.push(curveObject);
            scene.add(curveObject);
            curveObject.visible = false;
        }
    });
    //#endregion

    //#region MISC MESH
    let chest;
    const chestPosition = [4, 0, 6]
    gltfLoader.load('../../resources/chest.glb', (gltf) => {
        console.log(UTILS_GENERAL.dumpObject(gltf.scene).join('\n'));
        console.log(gltf.animations);

        chest = UTILS_SKELETON.createChest(scene, gltf.scene, gltf.animations, chestPosition);
    });

    const pillarPositions = [
        [7, 0, 7],
        [7, 0, 21],
        [21, 0, 7],
        [21, 0, 21],
    ]
    gltfLoader.load('../../resources/floor.glb', (gltf) => {
        console.log(UTILS_GENERAL.dumpObject(gltf.scene).join('\n'));

        UTILS_PROCEDURAL.createCharacter(scene, gltf.scene, [0, 0, 0], true);
    });
    
    gltfLoader.load('../../resources/paintings.glb', (gltf) => {
        console.log(UTILS_GENERAL.dumpObject(gltf.scene).join('\n'));

        UTILS_PROCEDURAL.createCharacter(scene, gltf.scene, [0, 0, 0], true);
    });
    //#endregion

    //#region COLLIDERS
    const pillarColliders = [];
    for (let i = 0; i < pillarPositions.length; i++)
    {
        const pillarPosition = pillarPositions[i];
        pillarColliders.push(
            new THREE.Box3(
                new THREE.Vector3().addVectors(new THREE.Vector3(...pillarPosition), new THREE.Vector3(-2, 0, -2)),
                new THREE.Vector3().addVectors(new THREE.Vector3(...pillarPosition), new THREE.Vector3(2, 0, 2))
        ));
    }

    const playerSphere = new THREE.Sphere();
    playerSphere.radius = 0.5;
    //#endregion

    //#region EVENTS THIRD PERSON
    const controlsThirdPerson = {
        keys: {
            'forward': false,
            'backward': false,
            'left': false,
            'right': false,
        },
        ease: new THREE.Vector3(),
        position: characterInitialPosition,
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

            if (chest.isOpen === true)
            {
                {
                    if (usingHammer)
                    return;

                    const hammerAction = controllableSkeleton.actions['Hammer'];
                    usingHammer = true;
                    const previousAction = controllableSkeleton.actions[controlsThirdPerson.current];

                    UTILS_SKELETON.prepareCrossFade(controllableSkeleton, previousAction, hammerAction, controlsThirdPerson.fadeDuration, false);
                }
            }

            if (chest.isOpen === false && chest.root.position.distanceToSquared(group.position) <= 1.8 ** 2)
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

            // check Collisions    
            nextPosition.copy(position).add(ease);
            nextPosition.x = THREE.MathUtils.clamp(nextPosition.x, -0.5, 28.5);
            nextPosition.z = THREE.MathUtils.clamp(nextPosition.z, -0.5, 28.5);
            actualMovement.subVectors(nextPosition, position);
            playerSphere.center.copy(nextPosition);

            let blocked = false;
            for (const pillarCollider of pillarColliders)
            {
                if (pillarCollider.intersectsSphere(playerSphere))
                {
                    blocked = true;
                    break;
                }
            };

            if (chest && nextPosition.distanceToSquared(chest.root.position) <= 0.8 ** 2)
                blocked = true;

            if(!blocked)
            {
                position.copy(nextPosition);
                camera.position.add(actualMovement);

                group.position.copy(position);
            }
    
            group.quaternion.rotateTowards(rotate, controlsThirdPerson.rotateSpeed * delta);
    
            orbitControls.target.copy(position).add({x: 0, y: 1, z: 0});
            followGroup.position.copy(position);
        }
    
        //controllableSkeleton.mixer.update(delta);
        //orbitControls.update();
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
            bench.fps         = Math.round(frameCount / (elapsed - fpsTimestamp));
            bench.drawCalls   = renderer.info.render.calls;
            bench.triangles   = renderer.info.render.triangles;
            bench.geometries  = renderer.info.memory.geometries;
            frameCount        = 0;
            fpsTimestamp      = elapsed;
        }

        if (controllableSkeleton)
        {
            if (!usingHammer)
                updateCharacter(delta);
            
            controllableSkeleton.mixer.update(delta);
        }
            

        if (chest)
        {
            chest.mixer.update(delta);
        }

        if (bats.length > 0)
        {
            UTILS_PROCEDURAL.updateObjectsOnCurve(curveBat.curve, curveBat.curveObject, batRoots, elapsed, 0.007);
            
            for (let i = 0; i < bats.length; i++)
            {
                const bat = bats[i];
                bat.mixer.update(delta);
                bat.light.target.position.set(bat.root.position.x, 0, bat.root.position.z);
                bat.light.target.updateMatrixWorld();
            }
        }

        if (rats.length === curveRatPosition.length)
        {
            for (let i = 0; i < rats.length; i++)
            {
                const rat = rats[i];
                if (!rat.isDead)
                    UTILS_PROCEDURAL.updateObjectOnCurve(curveRats[i], curveRatObjects[i], rat.root, elapsed, 0.02);
            }
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