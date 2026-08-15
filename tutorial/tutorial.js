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

    const group = new THREE.Group();
    const followGroup = new THREE.Group();
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
    
    orbitControls.enableDamping = true;
    orbitControls.enablePan = true;
    orbitControls.maxPolarAngle = Math.PI / 2 - 0.05;
    
    orbitControls.update();

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('lightblue');
    scene.add(group);
    scene.add(followGroup);
    //#endregion

    //#region LIGHT
    const intensity = 3;
    const light = new THREE.DirectionalLight(0xFFFFFF, intensity);
    light.position.set(5, 3, 3);
    light.target.position.set(0, 1, 0); // Point at the center of the world
    light.castShadow = true;
    
    light.shadow.camera.left = -5;
    light.shadow.camera.right = 5;
    light.shadow.camera.top = 5;
    light.shadow.camera.bottom = -5;
    light.shadow.camera.near = 1;
    light.shadow.camera.far = 15;
    light.shadow.mapSize.width = 1024;
    light.shadow.mapSize.height = 1024;
    
    light.shadow.bias = -0.0001;
    light.shadow.normalBias = 0.05;
    
    followGroup.add(light);
    followGroup.add(light.target);
    
    /*scene.add(light);
    scene.add(light.target);*/
    
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
    let controllableSkeleton;

    const generalAnimationSettings = {
        'add skeleton': () => {
            const skel = UTILS_SKELETON.createCharacter(scene, rootSkel, animations, [Math.random() * 5 + 1, 0, Math.random() * - 5 + 1]);
            skeletons.push(skel);
            addSkeletonFolder(skel);
        },
        'remove skeleton': () => {
            removeSkeletonFolder();
        },
        'add rat': () => {
            const rat = UTILS_PROCEDURAL.createCharacter(scene, rootRat, [0, 0, 0]);
            rats.push(rat);
        },
        'remove rat': () => {
            if (rats.length > 1) 
            {
                const rat = rats.pop();
                scene.remove(rat.root);
            }
        },
    }

    const gui = new GUI();

    const animationFolder = gui.addFolder('Animation');
    const animationRigFolder = animationFolder.addFolder('Rig');
    animationRigFolder.add(generalAnimationSettings, 'add skeleton');
    animationRigFolder.add(generalAnimationSettings, 'remove skeleton');
    const animationProceduralFoler = animationFolder.addFolder('Procedural');
    animationProceduralFoler.add(generalAnimationSettings, 'add rat');
    animationProceduralFoler.add(generalAnimationSettings, 'remove rat');
    animationProceduralFoler.close();
    animationRigFolder.close();
    animationFolder.open();
    
    const gltfLoader = new GLTFLoader();
    gltfLoader.load('../resources/skeleton.glb', (gltf) => {
        rootSkel = gltf.scene;
        animations = gltf.animations
        console.log(dumpObject(rootSkel).join('\n'));

        // controllable skeleton
        controllableSkeleton = UTILS_SKELETON.createCharacter(scene, rootSkel, animations, [0, 0, 0]);
        group.add(controllableSkeleton.root);

        // default first skeleton
        skeletons.push(UTILS_SKELETON.createCharacter(scene, rootSkel, animations, [0, 0, -2]));
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

    //#region CURVE
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
    //#endregion

    //#region EVENTS
    const controlsThirdPerson = {
        key: [0, 0],
        ease: new THREE.Vector3(),
        position: new THREE.Vector3(),
        up: new THREE.Vector3(0, 1, 0),
        rotate: new THREE.Quaternion(),
        current: 'Idle',
        fadeDuration: 0.5,
        //runVelocity: 5,
        walkVelocity: 1.8,
        rotateSpeed: 0.05,
        floorDecale: 0,
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);

    function onKeyDown(event)
    {
        const key = controlsThirdPerson.key;
        switch (event.code)
        {
            case 'ArrowUp': case 'KeyW': key[0] = -1; break;
            case 'ArrowDown': case 'KeyS': key[0] = 1; break;
            case 'ArrowLeft': case 'KeyA': key[1] = -1; break;
            case 'ArrowRigh': case 'KeyD': key[1] = 1; break;
        }
    }

    function onKeyUp(event)
    {
        const key = controlsThirdPerson.key;
        switch (event.code)
        {
            case 'ArrowUp': case 'KeyW': key[0] = key[0] < 0 ? 0 : key[0]; break;
            case 'ArrowDown': case 'KeyS': key[0] = key[0] > 0 ? 0 : key[0]; break;
            case 'ArrowLeft': case 'KeyA': key[1] = key[1] < 0 ? 0 : key[1]; break;
            case 'ArrowRigh': case 'KeyD': key[1] = key[1] > 0 ? 0 : key[1]; break;
        }
    } 

    function updateCharacter(delta)
    {
        const fade = controlsThirdPerson.fadeDuration;
        const key = controlsThirdPerson.key;
        const up = controlsThirdPerson.up;
        const ease = controlsThirdPerson.ease;
        const rotate = controlsThirdPerson.rotate;
        const position = controlsThirdPerson.position;
        const azimuth = orbitControls.getAzimuthalAngle();

        const active = key[0] === 0 && key[1] === 0 ? false : true;
        const play = active ? 'Walk' : 'Idle';

        // change animation
        if (controlsThirdPerson.current != play)
        {
            const current = controllableSkeleton.actions[play];
            const old = controllableSkeleton.actions[controlsThirdPerson.current];
            controlsThirdPerson.current = play;

            current.reset();
            current.weight = 1.0;
            current.stopFading();
            old.stopFading();
            if (play !== 'Idle') current.time = old.time * (current.getClip().duration / old.getClip().duration);
            old._scheduleFading(fade, old.getEffectiveWeight(), 0);
            current._scheduleFading(fade, current.getEffectiveWeight(), 1);
            current.play();
        }

        // move object
        if (controlsThirdPerson.current !== 'Idle')
        {
            // run/walk velocity
            const velocity = controlsThirdPerson.walkVelocity;

            // direction with key
            ease.set(key[1], 0, key[0]).multiplyScalar(velocity * delta);

            // calculate camera direction
            const angle = unwrapRad(Math.atan2(ease.x, ease.z) + azimuth);
            rotate.setFromAxisAngle(up, angle);

            // apply camera angle on ease
            controlsThirdPerson.ease.applyAxisAngle(up, azimuth);

            position.add(ease);
            camera.position.add(ease);

            group.position.copy(position);
            group.quaternion.rotateTowards(rotate, controlsThirdPerson.rotateSpeed);

            orbitControls.target.copy(position).add({x: 0, y: 1, z: 0});
            followGroup.position.copy(position);

            // Move the floor without any limit??
        }

        if (controllableSkeleton.mixer) controllableSkeleton.mixer.update(delta);
        orbitControls.update();
    }

    function unwrapRad(r)
    {
        return Math.atan2(Math.sin(r), Math.cos(r));
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

        updateCharacter(mixerUpdateDelta);

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