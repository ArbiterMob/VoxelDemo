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
    const radius =  1.0;
    const widthSegments = 24;
    const heightSegments = 16;
    const geometry = new THREE.SphereGeometry(radius, widthSegments, heightSegments);
    
    const sphereLinear = makeInstance(geometry, 0x44aa88, [0, 1.5, 0]);
    const sphereSmooth = makeInstance(geometry, 0x8844aa, [3, 1.5, 0]);

    const plane = new THREE.Mesh( new THREE.PlaneGeometry( 100, 100 ), new THREE.MeshPhongMaterial( { color: 0xcbcbcb, depthWrite: false } ) );
    plane.rotation.x = - Math.PI / 2;
    plane.receiveShadow = true;
    plane.position.set(0, -1, 0);
    scene.add(plane);

    function makeInstance(geometry, color, position) 
    {
        const material = new THREE.MeshPhongMaterial({color});
        const sphere = new THREE.Mesh(geometry, material);
        sphere.castShadow = true;
        sphere.receiveShadow = true;
        scene.add(sphere);
        sphere.position.set(...position);

        const startPosition = new THREE.Vector3();
        startPosition.copy(sphere.position);
        const endPosition = new THREE.Vector3();
        endPosition.addVectors(startPosition, new THREE.Vector3(0, 0, 3));
        console.log(startPosition, endPosition)
        const duration = 3;

        return {
            mesh: sphere,
            startPosition,
            endPosition,
            duration,
            animationTime: 0,
        };
    }

    function loopAnimation(sphere)
    {
        if (sphere.animationTime >= sphere.duration)
        {
            sphere.animationTime = 0;
            const temporary = sphere.startPosition.clone();
            sphere.startPosition.copy(sphere.endPosition);
            sphere.endPosition.copy(temporary);
        }
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
        //const elapsed = timer.getElapsed();
        const delta = timer.getDelta();

        if (UTILS_GENERAL.resizeRendererToDisplaySize(renderer))
        {
            const canvas = renderer.domElement;
            camera.aspect = canvas.clientWidth / canvas.clientHeight;
            camera.updateProjectionMatrix();
        }

        sphereLinear.animationTime += delta;
        const alpha = Math.min(sphereLinear.animationTime / sphereLinear.duration, 1);
        sphereLinear.mesh.position.lerpVectors(sphereLinear.startPosition, sphereLinear.endPosition, alpha);
        loopAnimation(sphereLinear);

        sphereSmooth.animationTime += delta;
        const alpha_temp = Math.min(sphereSmooth.animationTime / sphereSmooth.duration, 1)
        const smoothAlpha = alpha_temp * alpha_temp * (3 - 2 * alpha_temp);
        sphereSmooth.mesh.position.lerpVectors(sphereSmooth.startPosition, sphereSmooth.endPosition, smoothAlpha);
        loopAnimation(sphereSmooth);

        orbitControls.update();
        stats.update();
        renderer.render(scene, camera);
        requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
    //#endregion
}

main();