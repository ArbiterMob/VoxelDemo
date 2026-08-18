import * as THREE from 'three';
import * as UTILS_GENERAL from '../utilsGeneral.js';
import Stats from "three/examples/jsm/libs/stats.module";

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
    
    light.shadow.camera.far = 25;

    scene.add(light);
    scene.add(light.target);
    scene.add(ambientlight);
    scene.add(lightHelper);
    scene.add(shadowCameraHelper);
    //#endregion

    //#region MESH
    const boxWidth = 1;
    const boxHeight = 1;
    const boxDepth = 1;
    const geometry = new THREE.BoxGeometry(boxWidth, boxHeight, boxDepth);
    
    const cubes = [
        makeInstance(geometry, 0x44aa88, [0, 1.5, 0]),
        makeInstance(geometry, 0x8844aa, [-3, 1.5, 0]),
        makeInstance(geometry, 0xaa8844, [3, 1.5, 0]),
    ];

    const plane = new THREE.Mesh( new THREE.PlaneGeometry( 100, 100 ), new THREE.MeshPhongMaterial( { color: 0xcbcbcb, depthWrite: false } ) );
    plane.rotation.x = - Math.PI / 2;
    plane.receiveShadow = true;
    plane.position.set(0, -1, 0);
    scene.add(plane);

    function makeInstance(geometry, color, position) 
    {
        const material = new THREE.MeshPhongMaterial({color});
        const cube = new THREE.Mesh(geometry, material);
        cube.castShadow = true;
        cube.receiveShadow = true;
        scene.add(cube);
        cube.position.set(...position);
        return cube;
    }
    //#endregion

    //#region RENDER
    const stats = Stats();
    document.body.appendChild(stats.dom);

    let timer = new THREE.Timer()
    timer.connect(document);

    function render()
    {
        timer.update();
        const elapsed = timer.getElapsed();
        const delta = timer.getDelta();

        if (UTILS_GENERAL.resizeRendererToDisplaySize(renderer))
        {
            const canvas = renderer.domElement;
            camera.aspect = canvas.clientWidth / canvas.clientHeight;
            camera.updateProjectionMatrix();
        }

        cubes.forEach((cube, ndx) => {
            const speed = 1 + ndx * 0.1;
            const rot = delta * speed;
            cube.rotation.x += rot;
            cube.rotation.y += rot;
        });

        cubes[0].position.y = 2.5 + Math.sin(elapsed);

        cubes[1].scale.setScalar(2 + Math.sin(elapsed) * 0.5);

        orbitControls.update();
        stats.update();
        renderer.render(scene, camera);
        requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
    //#endregion
}

main();