import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';


export function createScene(canvas)
{
    const renderer = new THREE.WebGLRenderer({ antialias: true, canvas });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0; 
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;

    const fov = 45;
    const aspect = 2;
    const near = 0.1;
    const far = 100;
    const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
    camera.position.set(2, 2, 2);

    const orbitControls = new OrbitControls(camera, canvas);
    orbitControls.enableDamping = true;
    orbitControls.enablePan = true;
    orbitControls.update();

    const scene = new THREE.Scene();
    
    return {
        renderer,
        scene,
        camera,
        orbitControls,
    };
}

export function createLight()
{
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

    const ambientlight = new THREE.AmbientLight(0xFFFFFF, 0.35);

    const lightHelper = new THREE.DirectionalLightHelper(light);
    lightHelper.visible = false;

    const shadowCameraHelper = new THREE.CameraHelper(light.shadow.camera);
    shadowCameraHelper.visible = false;

    return {
        light,
        ambientlight,
        lightHelper,
        shadowCameraHelper,
    };
}

export function resizeRendererToDisplaySize(renderer)
{
    const canvas = renderer.domElement;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    
    const needResize = canvas.width !== width || canvas.height !== height;
    if (needResize) {
        renderer.setSize(width, height, false);
    }
    
    return needResize;
}

export function dumpObject(obj, lines = [], isLast = true, prefix = '')
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

export function unwrapRad(r)
{
    return Math.atan2(Math.sin(r), Math.cos(r));
}

export function calculateDistance(pos1, pos2)
{
    const x = pos1.x - pos2.x;
    const y = pos1.y - pos2.y;
    const z = pos1.z - pos2.z;

    return Math.sqrt(x**2 + y**2 + z**2);
}