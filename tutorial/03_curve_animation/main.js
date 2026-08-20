import * as THREE from 'three';
import * as UTILS from '../../utils.js';
import * as UTILS_GENERAL from '../utilsGeneral.js';
import * as UTILS_PROCEDURAL from '../utilsProcedural.js';
import Stats from "three/examples/jsm/libs/stats.module";
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

function main()
{
    //#region RENDERER, CAMERA, SCENE
    const canvas = document.querySelector('#c');
    const {renderer, scene, camera, orbitControls} = UTILS_GENERAL.createScene(canvas);
    camera.position.set(7, 5, 10);
    orbitControls.maxPolarAngle = Math.PI / 2 - 0.05;
    orbitControls.update();
    //#endregion

    //#region LIGHT
    const {light, ambientlight, lightHelper, shadowCameraHelper} = UTILS_GENERAL.createLight();
    
    light.shadow.camera.left = -10;
    light.shadow.camera.right = 10;
    light.shadow.camera.far = 25;

    scene.add(light);
    scene.add(light.target);
    scene.add(ambientlight);
    scene.add(lightHelper);
    scene.add(shadowCameraHelper);
    //#endregion

    //#region MESH
    const radius = 0.5;
    const height = 1;
    const radialSegments = 16;
    const geometry = new THREE.ConeGeometry( radius, height, radialSegments );
    
    const cones = [
        makeInstance(geometry, 0x44aa88, [0, 1.5, 0]),
        makeInstance(geometry, 0x8844aa, [-3, 1.5, 0]),
        makeInstance(geometry, 0xaa8844, [3, 1.5, 0]),
    ];
    let meshes = cones;

    const plane = new THREE.Mesh( new THREE.PlaneGeometry( 100, 100 ), new THREE.MeshPhongMaterial( { color: 0xcbcbcb, depthWrite: false } ) );
    plane.rotation.x = - Math.PI / 2;
    plane.receiveShadow = true;
    //plane.position.set(0, -1, 0);
    scene.add(plane);

    const rats = [];
    const gltfLoader = new GLTFLoader();
    let rootRat;
    gltfLoader.load('../../resources/rat.glb', (gltf) => {
        rootRat = gltf.scene;
        console.log(UTILS_GENERAL.dumpObject(rootRat).join('\n'));

        for (let i = 0; i < meshes.length; i++)
        {
            rats.push(UTILS_PROCEDURAL.createCharacter(scene, rootRat, [0, 0, 0]));
            rats[i].root.visible = false;
        }
    });

    function makeInstance(geometry, color, position) 
    {
        const material = new THREE.MeshPhongMaterial({color});
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);
        mesh.position.set(...position);
        return mesh;
    }
    //#endregion

    //#region CURVE
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
    
    const {curve, curveObject} = UTILS_PROCEDURAL.createCurve(controlPointsRat);
    scene.add(curveObject);
    //#endregion

    //#region GUI
    const gui = new GUI();

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

    const guiState = { shadows: true, fog: true, 'use glb meshes': false};

    gui.add(guiState, 'use glb meshes').onChange((useRats) => {
        if (useRats === true)
        {
            const tempList = [];
            rats.forEach((rat) => {
                rat.root.visible = true;
                tempList.push(rat.root);
            })
            cones.forEach((cone) => {
                cone.visible = false;
            })

            meshes = tempList;
        }
        else 
        {
            rats.forEach((rat) => {
                rat.root.visible = false;
            })
            cones.forEach((cone) => {
                cone.visible = true;
            })

            meshes = cones;
        }
    });

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
        //const delta = timer.getDelta();
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

        if (meshes.length > 0)
            UTILS_PROCEDURAL.updateObjectsOnCurve(curve, curveObject, meshes, elapsed);

        orbitControls.update();
        stats.update();
        renderer.render(scene, camera);
        requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
    //#endregion
}

main();