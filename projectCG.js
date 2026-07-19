import * as THREE from 'three';
import * as UTILS from './utils.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import Stats from "three/examples/jsm/libs/stats.module";
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { randInt } from 'three/src/math/MathUtils.js';


import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { BloomPass } from 'three/addons/postprocessing/BloomPass.js';
import { FilmPass } from 'three/addons/postprocessing/FilmPass.js';

import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { RGBShiftShader } from 'three/addons/shaders/RGBShiftShader.js';
import { DotScreenShader } from 'three/addons/shaders/DotScreenShader.js';

import { HalftonePass } from 'three/addons/postprocessing/HalftonePass.js';

import { RenderPixelatedPass } from 'three/addons/postprocessing/RenderPixelatedPass.js';


class VoxelWorld
{
    constructor(options)
    {
        this.cellSize = options.cellSize;
        this.tileSize = options.tileSize;
        this.tileTextureWidth = options.tileTextureWidth;
        this.tileTextureHeight = options.tileTextureHeight;
        const {cellSize} = this;
        this.cellSliceSize = cellSize * cellSize;
        this.cells = {};
    }

    computeCellId(x, y, z)
    {
        const {cellSize} = this;
        const cellX = Math.floor(x / cellSize);
        const cellY = Math.floor(y / cellSize);
        const cellZ = Math.floor(z / cellSize);
        return `${cellX}, ${cellY}, ${cellZ}`;
    }

    getCellForVoxel(x, y, z)
    {
        return this.cells[this.computeCellId(x, y, z)];
    }

    computeVoxelOffset(x, y, z)
    {
        const {cellSize, cellSliceSize} = this;
        const voxelX = THREE.MathUtils.euclideanModulo(x, cellSize) | 0;
        const voxelY = THREE.MathUtils.euclideanModulo(y, cellSize) | 0;
        const voxelZ = THREE.MathUtils.euclideanModulo(z, cellSize) | 0;
        return voxelY * cellSliceSize +
                voxelZ * cellSize +
                voxelX;
    }

    getVoxel(x, y, z)
    {
        const cell = this.getCellForVoxel(x, y, z);
        if (!cell) 
        {
            return 0;
        }
        const voxelOffset = this.computeVoxelOffset(x, y, z);
        return cell[voxelOffset];
    }

    setVoxel(x, y, z, v)
    {
        let cell = this.getCellForVoxel(x, y, z);
        if (!cell)
        {
            cell = this.addCellForVoxel(x, y, z);
        }
        const voxelOffset = this.computeVoxelOffset(x, y, z);
        cell[voxelOffset] = v;
    }

    addCellForVoxel(x, y, z)
    {
        const cellId = this.computeCellId(x, y, z);
        let cell = this.cells[cellId];
        if (!cell)
        {
            const {cellSize} = this;
            cell = new Uint8Array(cellSize * cellSize * cellSize);
            this.cells[cellId] = cell;
        }
        return cell;
    }

    generateGeometryDataForCell(cellX, cellY, cellZ)
    {
        const {cellSize, tileSize, tileTextureWidth, tileTextureHeight} = this;

        const positions = [];
        const normals = [];
        const uvs = [];
        const indices = [];

        const startX = cellX * cellSize;
        const startY = cellY * cellSize;
        const startZ = cellZ * cellSize;

        for (let y = 0; y < cellSize; y++)
        {
            const voxelY = startY + y;
            for (let z = 0; z < cellSize; z++)
            {
                const voxelZ = startZ + z;
                for (let x = 0; x < cellSize; x++)
                {
                    const voxelX = startX + x;
                    const voxel = this.getVoxel(voxelX, voxelY, voxelZ);
                    if (voxel)
                    {
                        const uvVoxel = voxel - 1; // voxel 0 is sky so for UVs we start at 0

                        for (const {dir, corners, uvRow} of VoxelWorld.faces)
                        {
                            const neighbour = this.getVoxel(
                                voxelX + dir[0],
                                voxelY + dir[1],
                                voxelZ + dir[2]
                            );
                            
                            if (!neighbour)
                            {
                                const ndx = positions.length / 3;
                                for (const {pos, uv} of corners)
                                {
                                    positions.push(pos[0] + voxelX, pos[1] + voxelY, pos[2] + voxelZ);
                                    normals.push(...dir);
                                    uvs.push(
                                        (uvVoxel + uv[0]) * tileSize / tileTextureWidth,
                                        1 - (uvRow + 1 - uv[1]) * tileSize / tileTextureHeight
                                    );
                                }
                                indices.push(ndx, ndx + 1, ndx + 2,
                                    ndx + 2, ndx + 1, ndx + 3,
                                );
                            }
                        }
                    }
                }
            }
        }

        return {
            positions,
            normals,
            uvs,
            indices,
        };
    }

    intersectRay(normalizedPosition, scene, camera, maxDistance)
    {
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(normalizedPosition, camera);
        raycaster.far = maxDistance;

        const intersectedObjects = raycaster.intersectObjects(scene.children);
        const intersection = intersectedObjects.find(intersect => intersect.object instanceof THREE.Mesh && intersect.face);

        if (intersection)
        {
            const point = intersection.point;
            const normal = intersection.face.normal;

            const voxelX = Math.floor(point.x - normal.x * 0.5);
            const voxelY = Math.floor(point.y - normal.y * 0.5);
            const voxelZ = Math.floor(point.z - normal.z * 0.5);
            const voxel = this.getVoxel(voxelX, voxelY, voxelZ);

            return {
                position: point,
                normal: normal,
                voxel,
            };
        }
    }
}

VoxelWorld.faces = 
[
    {   // left
        uvRow: 0,
        dir: [-1, 0, 0],
        corners:
        [
            { pos: [0, 1, 0], uv: [0, 1], },
            { pos: [0, 0, 0], uv: [0, 0], },
            { pos: [0, 1, 1], uv: [1, 1], },
            { pos: [0, 0, 1], uv: [1, 0], },
        ],
    },
    {   // right
        uvRow: 0,
        dir: [1, 0, 0],
        corners:
        [
            { pos: [1, 1, 1], uv: [0, 1], },
            { pos: [1, 0, 1], uv: [0, 0], },
            { pos: [1, 1, 0], uv: [1, 1], },
            { pos: [1, 0, 0], uv: [1, 0], },
        ]
    },
    {   // bottom
        uvRow: 1,
        dir: [0, -1, 0],
        corners:
        [
            { pos: [1, 0, 1], uv: [1, 0], },
            { pos: [0, 0, 1], uv: [0, 0], },
            { pos: [1, 0, 0], uv: [1, 1], },
            { pos: [0, 0, 0], uv: [0, 1], },
        ]
    },
    {   // top
        uvRow: 2,
        dir: [0, 1, 0],
        corners:
        [
            { pos: [0, 1, 1], uv: [1, 1], },
            { pos: [1, 1, 1], uv: [0, 1], },
            { pos: [0, 1, 0], uv: [1, 0], },
            { pos: [1, 1, 0], uv: [0, 0], },
        ]
    },
    {   // back
        uvRow: 0,
        dir: [0, 0, -1],
        corners:
        [
            { pos: [1, 0, 0], uv: [0, 0], },
            { pos: [0, 0, 0], uv: [1, 0], },
            { pos: [1, 1, 0], uv: [0, 1], },
            { pos: [0, 1, 0], uv: [1, 1], },
        ]
    },
    {   // front
        uvRow: 0,
        dir: [0, 0, 1],
        corners:
        [
            { pos: [0, 0, 1], uv: [0, 0], },
            { pos: [1, 0, 1], uv: [1, 0], },
            { pos: [0, 1, 1], uv: [0, 1], },
            { pos: [1, 1, 1], uv: [1, 1], },
        ]
    },
];

function main() {
    //#region RENDERER
    const canvas = document.querySelector("#c");
    const renderer = new THREE.WebGLRenderer({ antialias: true, canvas });
    renderer.shadowMap.enabled = true;
    //#endregion

    //#region CAMERA, SCENE
    const tileSize = 16;
    const tileTextureWidth = 128;
    const tileTextureHeight = 64;
    const cellSize = 32;
    const world = new VoxelWorld({
        cellSize,
        tileSize,
        tileTextureWidth,
        tileTextureHeight,
    });
    const lightColor = 0x99C1F1;

    const fov = 45;
    const aspect = 2;
    const near = 0.1;
    const far = 1000;
    const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
    camera.position.set(- cellSize * .3, cellSize * .8, - cellSize * .3 );
    //camera.position.set(- cellSize * 1.5,  cellSize * .8, - cellSize * 1.5 );
    //camera.position.set(0, 10, 20);

    const fpCamera = new THREE.PerspectiveCamera(100, aspect, near, far);
    fpCamera.position.set(cellSize / 2 + 2, 15, cellSize / 2 + 2);

    let activeCamera;

    const orbitControls = new OrbitControls(camera, canvas);
    orbitControls.target.set(cellSize, cellSize / 3, cellSize);
	/*orbitControls.enableDamping = true;
    orbitControls.dampingFactor = 0.05;
    orbitControls.minDistance = 3;
    orbitControls.maxDistance = 10;
    orbitControls.minPolarAngle = Math.PI / 4;
    orbitControls.maxPolarAngle = (3 * Math.PI) / 4;*/
    orbitControls.update();

    const fpControls = new PointerLockControls(fpCamera, canvas);

    const scene = new THREE.Scene();
    //scene.background = new THREE.Color('lightblue');
    scene.background = new THREE.Color(lightColor);

    const sceneFog = new THREE.Fog(lightColor, 0.1, 50);
    scene.fog = sceneFog;
    //#endregion

    //#region LIGHT
    //const lightColor = 0x1A5FB4;
    const intensity = 3;
    const light = new THREE.DirectionalLight(lightColor, intensity);
    light.position.set(85, 60, 80);
    light.target.position.set(16, 12, 16); // Point at the center of the world
    light.castShadow = true;

    light.shadow.camera.left = -125;
    light.shadow.camera.right = 125;
    light.shadow.camera.top = 125;
    light.shadow.camera.bottom = -125;
    light.shadow.camera.near = 1;
    light.shadow.camera.far = 150;
    light.shadow.mapSize.width = 8192;
    light.shadow.mapSize.height = 8192;

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

    //#region POST PROCESSING
    const composer = new EffectComposer(renderer)
    
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);
    
    // %%% Bloom + Film %%%
    const bloomPass = new BloomPass(1, 25, 4, 256);
    composer.addPass(bloomPass);
    const filmPass = new FilmPass(0.5, false);
    composer.addPass(filmPass);

    // %%% DotScreen + RGBShift %%%
    const dotScreenPass = new ShaderPass(DotScreenShader);
    dotScreenPass.uniforms['scale'].value = 4;
    composer.addPass(dotScreenPass);
    const rgbShiftPass = new ShaderPass(RGBShiftShader);
    rgbShiftPass.uniforms['amount'].value = 0.0015;
    composer.addPass(rgbShiftPass);

    // %%% Halftone %%%
    const halToneParams = 
    {
        shape: 1,
        radius: 4,
        rotateR: Math.PI / 12,
        rotateG: Math.PI / 12 * 2,
        rotateB: Math.PI / 12 * 3,
        scatter: 0,
        blending: 1,
        blendingMode: 1,
        greyscale: false,
        //disable: false,
    }
    const halftonePass = new HalftonePass(halToneParams);
    composer.addPass(halftonePass);

    // %%% Pixelated %%%
    const renderPixelatedPass = new RenderPixelatedPass(6, scene, camera);
    composer.addPass(renderPixelatedPass);

    const outputPass = new OutputPass();
    composer.addPass(outputPass);

    function updatePostProcessingEffects(selectedEffect)
    {
        bloomPass.enabled = false;
        filmPass.enabled = false;
        dotScreenPass.enabled = false;
        rgbShiftPass.enabled = false;
        halftonePass.enabled = false;
        renderPixelatedPass.enabled = false;

        if (selectedEffect === 'bloomFilm')
        {
            bloomPass.enabled = true;
            filmPass.enabled = true;
        }
        else if (selectedEffect === 'dotScreenRGBShift')
        {
            dotScreenPass.enabled = true;
            rgbShiftPass.enabled = true;
        }
        else if (selectedEffect === 'halftone')
        {
            halftonePass.enabled = true;
        }
        else if (selectedEffect === 'pixelated')
        {
            renderPixelatedPass.enabled = true;
            renderPixelatedPass.camera = activeCamera;
        }
    }
    //#endregion

    //#region LOAD GLB/GLTF 
    let davyJonesMesh;

    const gltfLoader = new GLTFLoader();
    gltfLoader.load('./resources/davyJones.glb', (gltf) => {
        const root = gltf.scene;
        console.log(dumpObject(root).join('\n'));
        davyJonesMesh = root.getObjectByName('davyJones');
        davyJonesMesh.material = new THREE.MeshStandardMaterial({
            vertexColors: true,
        })
        davyJonesMesh.geometry.computeVertexNormals();
        davyJonesMesh.castShadow = true;
        davyJonesMesh.receiveShadow = true;
        davyJonesMesh.position.copy(fpCamera.position);
        davyJonesMesh.visible = false;
        scene.add(davyJonesMesh);
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
    //#endregion

    //#region MESH
    const loader = new THREE.TextureLoader();
    const texture = loader.load('./resources/atlasPOT.png', render);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.colorSpace = THREE.SRGBColorSpace;
    
    for (let i = 0; i < 2; i++) {
        for (let j = 0; j < 2; j++) {
            for (let y = 0; y < cellSize; y++) {
                for (let z = 0; z < cellSize; z++) {
                    for (let x = 0; x < cellSize; x++) {
                        const height = (Math.sin((j * cellSize + x) / cellSize * Math.PI * 2) + Math.sin((i * cellSize + z) / cellSize * Math.PI * 3)) * (cellSize / 6) + (cellSize / 2);
                        if (y < height) {
                            world.setVoxel(j*cellSize + x, y, i*cellSize + z, randInt(1, 8));
                        }
                    }
                }
            }
        }
    }

    const cellIdToMesh = {};
    const material = new THREE.MeshLambertMaterial({
        map: texture,
        side: THREE.DoubleSide,
        /*alphaTest: 0.1,
        transparent: true,*/
    });
    

    function updateCellGeometry(x, y, z)
    {
        const cellX= Math.floor(x / cellSize);
        const cellY = Math.floor(y / cellSize);
        const cellZ = Math.floor(z / cellSize);
        const cellId = world.computeCellId(x, y, z);
        
        let mesh = cellIdToMesh[cellId];
        const geometry = mesh ? mesh.geometry : new THREE.BufferGeometry();

        const {positions, normals, uvs, indices} = world.generateGeometryDataForCell(cellX, cellY, cellZ);
        const positionNumComponents = 3;
        geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), positionNumComponents));
        const normalNumComponents = 3;
        geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(normals), normalNumComponents));
        const uvNumComponents = 2;
        geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), uvNumComponents));
        geometry.setIndex(indices);
        geometry.computeBoundingSphere();

        if (!mesh)
        {
            mesh = new THREE.Mesh(geometry, material);
            mesh.name = cellId;
            cellIdToMesh[cellId] = mesh;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            scene.add(mesh);
        }
    }

    for (let i = 0; i < 2; i++) {
        for (let j = 0; j < 2; j++) {
            updateCellGeometry(j * cellSize, 0, i * cellSize);
        }
    }
    //#endregion

    //#region FP MOVEMENT
    const raycasterFar = 1.5;
    let raycasterDown = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, -1, 0), 0, raycasterFar);
    let rayCasterTop = new THREE.Raycaster();
    let raycasterRight = new THREE.Raycaster();
    let raycasterLeft = new THREE.Raycaster();
    let raycasterFront = new THREE.Raycaster();
    let raycasterBack = new THREE.Raycaster();

	let moveForward = false;
	let moveBackward = false;
	let moveLeft = false;
	let moveRight = false;
	let canJump = false;

	let prevTime = performance.now();
	const velocity = new THREE.Vector3();
	const localInput = new THREE.Vector3();

    const onKeyDown = function(event)
    {
        switch (event.code)
        {
            case 'ArrowUp':
            case 'KeyW':
                moveForward = true;
                break;

            case 'ArrowLeft':
            case 'KeyA':
                moveLeft = true;
                break;

            case 'ArrowDown':
            case 'KeyS':
                moveBackward = true;
                break;

            case 'ArrowRight':
            case 'KeyD':
                moveRight = true;
                break;

            case 'Space':
                if (canJump === true) velocity.y += 30;
                canJump = false;
                break;

        }
    };

    const onKeyUp = function(event)
    {
        switch (event.code)
        {
            case 'ArrowUp':
            case 'KeyW':
                moveForward = false;
                break;

            case 'ArrowLeft':
            case 'KeyA':
                moveLeft = false;
                break;

            case 'ArrowDown':
            case 'KeyS':
                moveBackward = false;
                break;

            case 'ArrowRight':
            case 'KeyD':
                moveRight = false;
                break;
        }
    };
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
        activeCamera.updateProjectionMatrix();
    }

    const gui = new GUI();
    const guiState = { shadows: true, fog: true, fpCamera: false, };
    //initializeRendererControls(gui, renderer);
    //initializeHelperControls(gui, scene);

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
    const fpCameraFolder = cameraFolder.addFolder('First Person Camera');
    freeCameraFolder.add(camera, 'fov', 1, 180).onChange(updateCamera);
    const freeCameraMinMaxGUIHelper = new UTILS.MinMaxGUIHelper(camera, 'near', 'far', 0.1);
    freeCameraFolder.add(freeCameraMinMaxGUIHelper, 'min', 0.1, 50, 0.1).name('near').onChange(updateCamera);
    freeCameraFolder.add(freeCameraMinMaxGUIHelper, 'max', 0.1, 1000, 0.1).name('far').onChange(updateCamera);
    fpCameraFolder.add(fpCamera, 'fov', 1, 180).onChange(updateCamera);
    const fpCameraMinMaxGUIHelper = new UTILS.MinMaxGUIHelper(fpCamera, 'near', 'far', 0.1);
    fpCameraFolder.add(fpCameraMinMaxGUIHelper, 'min', 0.1, 50, 0.1).name('near').onChange(updateCamera);
    fpCameraFolder.add(fpCameraMinMaxGUIHelper, 'max', 0.1, 1000, 0.1).name('far').onChange(updateCamera);
    cameraFolder.close();

    const fogFolder = gui.addFolder('Fog');
    fogFolder.add(guiState, 'fog').name('Fog on').onChange((v) => {
        scene.fog = v ? sceneFog : null;
        scene.traverse((obj) => { if (obj.isMesh) obj.material.needsUpdate = true; });
    });
    const fogGUIHelper = new UTILS.FogGUIHelper(sceneFog, scene.background);
    fogFolder.add(fogGUIHelper, 'near', 1, 50).listen();
    fogFolder.add(fogGUIHelper, 'far', 1, 50).listen();
    fogFolder.addColor(fogGUIHelper, 'color');
    fogFolder.close();

    // %%% POST PROC GUI 
    const postProcessingController = { postProcessing: 'disabled' };
    const postProcessingFolder = gui.addFolder('Post Processing'); 
    postProcessingFolder.add(postProcessingController, 'postProcessing', {
        'Disabled': 'disabled',
        'Bloom+Film': 'bloomFilm',
        'DotScreen+RGBShift': 'dotScreenRGBShift',
        'Halftone': 'halftone',
        'Pixelated': 'pixelated',
    }).onChange(v => updatePostProcessingEffects(v));

    const bloomFilmFolder = postProcessingFolder.addFolder('Bloom+Film');
    const bloomPassFolder = bloomFilmFolder.addFolder('BloomPass');
    bloomPassFolder.add(bloomPass.combineUniforms.strength, 'value', 0, 2).name('strength');
    const filmPassFolder = bloomFilmFolder.addFolder('FilmPass');
    filmPassFolder.add(filmPass.uniforms.grayscale, 'value').name('grayscale');
    filmPassFolder.add(filmPass.uniforms.intensity, 'value', 0, 1).name('intensity');
    bloomFilmFolder.close();

    const halftoneController = 
    {
        shape: halftonePass.uniforms['shape'].value,
        radius: halftonePass.uniforms['radius'].value,
        rotateR: halftonePass.uniforms['rotateR'].value / (Math.PI / 180),
        rotateG: halftonePass.uniforms['rotateG'].value / (Math.PI / 180),
        rotateB: halftonePass.uniforms['rotateB'].value / (Math.PI / 180),
        scatter: halftonePass.uniforms['scatter'].value,
        blending: halftonePass.uniforms['blending'].value,
        blendingMode: halftonePass.uniforms['blendingMode'].value,
        greyscale: halftonePass.uniforms['greyscale'].value,
        //disable: halftonePass.uniforms['disable'].value,
    }
    const halftoneFolder = postProcessingFolder.addFolder('Halftone');
    halftoneFolder.add( halftoneController, 'shape', { 'Dot': 1, 'Ellipse': 2, 'Line': 3, 'Square': 4, 'Diamond': 5 } ).onChange( onHalftonePassGUIChange );
    halftoneFolder.add( halftoneController, 'radius', 1, 25 ).onChange(onHalftonePassGUIChange);
    halftoneFolder.add( halftoneController, 'rotateR', 0, 90 ).onChange(onHalftonePassGUIChange);
    halftoneFolder.add( halftoneController, 'rotateG', 0, 90 ).onChange(onHalftonePassGUIChange);
    halftoneFolder.add( halftoneController, 'rotateB', 0, 90 ).onChange(onHalftonePassGUIChange);
    halftoneFolder.add( halftoneController, 'scatter', 0, 1, 0.01 ).onChange(onHalftonePassGUIChange);
    halftoneFolder.add( halftoneController, 'greyscale' ).onChange(onHalftonePassGUIChange);
    halftoneFolder.add( halftoneController, 'blending', 0, 1, 0.01 ).onChange(onHalftonePassGUIChange);
    halftoneFolder.add( halftoneController, 'blendingMode', { 'Linear': 1, 'Multiply': 2, 'Add': 3, 'Lighter': 4, 'Darker': 5 } ).onChange( onHalftonePassGUIChange );
    //halftoneFolder.add( postProcessingController, 'disable' ).onChange(onHalftonePassGUIChange);
    halftoneFolder.close();

    function onHalftonePassGUIChange()
    {
        // update uniforms
        halftonePass.uniforms[ 'radius' ].value = halftoneController.radius;
        halftonePass.uniforms[ 'rotateR' ].value = halftoneController.rotateR * ( Math.PI / 180 );
        halftonePass.uniforms[ 'rotateG' ].value = halftoneController.rotateG * ( Math.PI / 180 );
        halftonePass.uniforms[ 'rotateB' ].value = halftoneController.rotateB * ( Math.PI / 180 );
        halftonePass.uniforms[ 'scatter' ].value = halftoneController.scatter;
        halftonePass.uniforms[ 'shape' ].value = halftoneController.shape;
        halftonePass.uniforms[ 'greyscale' ].value = halftoneController.greyscale;
        halftonePass.uniforms[ 'blending' ].value = halftoneController.blending;
        halftonePass.uniforms[ 'blendingMode' ].value = halftoneController.blendingMode;
        //halftonePass.uniforms[ 'disable' ].value = postProcessingController.disable;
    }

    const pixelatedController = 
    {
        pixelSize: 6,
        normalEdgeStrength: .3,
        depthEdgeStrength: .4,
    }
    const pixelatedFolder = postProcessingFolder.addFolder('Pixelated');
    pixelatedFolder.add(pixelatedController, 'pixelSize').min(1).max(16).step(1)
        .onChange(() => renderPixelatedPass.setPixelSize(pixelatedController.pixelSize));
    pixelatedFolder.add(renderPixelatedPass, 'normalEdgeStrength').min(0).max(2).step(.05);
    pixelatedFolder.add(renderPixelatedPass, 'depthEdgeStrength').min(0).max(1).step(.05);
    pixelatedFolder.close();
    postProcessingFolder.close();
    

    const optionsState = { activeCamera: 'firstPerson', raycaster: false };
    {
        activeCamera = fpCamera;
        renderPass.camera = fpCamera;
        orbitControls.enabled = false;
        document.addEventListener('keydown', onKeyDown);
        document.addEventListener('keyup', onKeyUp);
        if (document.activeElement) document.activeElement.blur();
    }
    const crosshair = document.querySelector("#crosshair");
    const optionsFolder = gui.addFolder('Game Options');
    optionsFolder.add(optionsState, 'activeCamera', { 'Free': 'free', 'First Person': 'firstPerson'}).onChange((v) => {
        if (v === 'free') 
        {
            activeCamera = camera;
            renderPass.camera = camera;
            renderPixelatedPass.camera = camera;

            fpControls.unlock();
            orbitControls.enabled = true;
            document.removeEventListener('keydown', onKeyDown);
            document.removeEventListener('keyup', onKeyUp);

            if (crosshair) crosshair.style.display = 'none';

            if (davyJonesMesh)
            {
                davyJonesMesh.position.copy(fpCamera.position);
                davyJonesMesh.position.y -= .08;

                const forward = new THREE.Vector3();
                fpControls.object.getWorldDirection(forward);
                forward.y = 0;
                forward.normalize();
                davyJonesMesh.rotation.y = Math.atan2(forward.x, forward.z);

                davyJonesMesh.visible = true;

                orbitControls.target.copy(davyJonesMesh.position);
                orbitControls.update();
            }
        }
        else if (v === 'firstPerson')
        {
            activeCamera = fpCamera;
            renderPass.camera = fpCamera;
            renderPixelatedPass.camera = fpCamera;

            fpControls.lock();
            orbitControls.enabled = false;
            document.addEventListener('keydown', onKeyDown);
            document.addEventListener('keyup', onKeyUp);

            if (document.activeElement) document.activeElement.blur();

            if (crosshair) crosshair.style.display = 'block';

            if (davyJonesMesh)
            {
                davyJonesMesh.visible = false;
            }
        }
    });
    optionsFolder.add(optionsState, 'raycaster')

    const bench = { fps: 0, drawCalls: 0, triangles: 0, geometries: 0 }
    const bf    = gui.addFolder('Renderer stats')
    bf.add(bench, 'fps').listen().disable()
    bf.add(bench, 'drawCalls').name('draw calls').listen().disable()
    bf.add(bench, 'triangles').listen().disable()
    bf.add(bench, 'geometries').listen().disable()
    bf.open()
    //#endregion

    //#region USER INTERFACE
    let currentVoxel = 0;
    let currentId;

    document.querySelectorAll('#ui .tiles input[type=radio][name=voxel]').forEach((elem) => {
        elem.addEventListener('click', allowUncheck);
    });

    function allowUncheck()
    {
        if (this.id === currentId)
        {
            this.checked = false;
            currentId = undefined;
            currentVoxel = 0;
        }
        else 
        {
            currentId = this.id;
            currentVoxel = parseInt(this.value);
        }
    }

    window.addEventListener('wheel', (event) => {
        if (activeCamera === fpCamera && fpControls.isLocked)
        {
            const voxelRadios = document.querySelectorAll('#ui .tiles input[type=radio][name=voxel]');
            const values = Array.from(voxelRadios).map(elem => parseInt(elem.value));
            let currentIndex = values.indexOf(currentVoxel);

            if (event.deltaY < 0)
                currentIndex = (currentIndex + 1) % values.length;
            else if (event.deltaY > 0)
                currentIndex = (currentIndex - 1 + values.length) % values.length;

            currentVoxel = values[currentIndex];

            voxelRadios.forEach((elem) => {
                if (parseInt(elem.value) === currentVoxel) 
                {
                    elem.checked = true;
                    currentId = elem.id;
                }
                else 
                {
                    elem.checked = false;
                }
            })
        }
    });
    //#endregion
    
    //#region RAYCASTER
    function getCanvasRelativePosition(event)
    {
        const rect = canvas.getBoundingClientRect();
        return {
            x: (event.clientX - rect.left) * canvas.width / rect.width,
            y: (event.clientY - rect.top) * canvas.height / rect.height,
        };
    }

    function placeVoxel(event)
    {
        let x, y;
        let maxDistance = 200;

        if (activeCamera === fpCamera)
        {
            x = 0;
            y = 0;
            maxDistance = 8;
        }
        else 
        {
            const pos = getCanvasRelativePosition(event);
            x = (pos.x / canvas.width ) *  2 - 1;
            y = (pos.y / canvas.height) * -2 + 1;
        }

        const intersection = world.intersectRay({x, y}, scene, activeCamera, maxDistance);
        if (intersection) 
        {
            const voxelId = event.shiftKey ? 0 : currentVoxel;

            // the intersection point is on the face. That means
            // the math imprecision could put us on either side of the face.
            // so go half a normal into the voxel if removing (currentVoxel = 0)
            // our out of the voxel if adding (currentVoxel  > 0)
            const offset = voxelId > 0 ? 0.5 : -0.5;
            const voxelX = Math.floor(intersection.position.x + intersection.normal.x * offset);
            const voxelY = Math.floor(intersection.position.y + intersection.normal.y * offset);
            const voxelZ = Math.floor(intersection.position.z + intersection.normal.z * offset);
            
            world.setVoxel(voxelX, voxelY, voxelZ, voxelId);
            updateVoxelGeometry(voxelX, voxelY, voxelZ);
        }
    }
    
    const mouse = {
        x: 0,
        y: 0,
    };

    function recordStartPosition(event)
    {
        mouse.x = event.clientX;
        mouse.y = event.clientY;
        mouse.moveX = 0;
        mouse.moveY = 0;
    }

    function recordMovement(event)
    {
        mouse.moveX += Math.abs(mouse.x - event.clientX);
        mouse.moveY += Math.abs(mouse.y - event.clientY);
    }

    function placeVoxelIfNoMovement(event)
    {   
        if (activeCamera === fpCamera)
        {
            if (!fpControls.isLocked)
            {
                if (document.activeElement) document.activeElement.blur();
                fpControls.lock();
            }
            else
            {
                placeVoxel(event);
            }
        }
        else if (mouse.moveX < 5 && mouse.moveY < 5)
        {
            placeVoxel(event);
        }
        window.removeEventListener('pointermove', recordMovement);
        window.removeEventListener('pointerup', placeVoxelIfNoMovement);
    }

    canvas.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        recordStartPosition(event);
        window.addEventListener('pointermove', recordMovement);
        window.addEventListener('pointerup', placeVoxelIfNoMovement);
    }, { passive: false });


    const neighbourOffsets = [
        [ 0,  0,  0],   // self
        [-1,  0,  0],   // left
        [ 1,  0,  0],   // right
        [ 0, -1,  0],   // down
        [ 0,  1,  0],   // up
        [ 0,  0, -1],   // back
        [ 0,  0,  1],   //front
    ]

    function updateVoxelGeometry(x, y, z)
    {
        const updatedCellIds = {};
        for (const offset of neighbourOffsets) 
        {
            const ox = x + offset[0];
            const oy = y + offset[1];
            const oz = z + offset[2];
            const cellId = world.computeCellId(ox, oy, oz);
            if (!updatedCellIds[cellId]) 
            {
                updatedCellIds[cellId] = true;
                updateCellGeometry(ox, oy, oz);
            }
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

    updatePostProcessingEffects(postProcessingController.postProcessing);

    function render() {

        const time = performance.now();
        frameCount++;

        if (resizeRendererToDisplaySize(renderer)) {
            const canvas = renderer.domElement;
            
            camera.aspect = canvas.clientWidth / canvas.clientHeight;
            camera.updateProjectionMatrix();

            fpCamera.aspect = canvas.clientWidth / canvas.clientHeight;
            fpCamera.updateProjectionMatrix();

            composer.setSize(canvas.width, canvas.height);
        }

        if (time - fpsTimestamp >= 500) {
            bench.fps         = Math.round(frameCount * 2);
            bench.drawCalls   = renderer.info.render.calls;
            bench.triangles   = renderer.info.render.triangles;
            bench.geometries  = renderer.info.memory.geometries;
            frameCount        = 0;
            fpsTimestamp      = time;
        }



        if (activeCamera === fpCamera && fpControls.isLocked)
        {
            const delta = (time - prevTime) / 1000;
            const playerPos = fpControls.object.position;

            if (optionsState.raycaster)
            {
                raycasterDown.ray.origin.copy(playerPos);
                //raycaster.ray.origin.y += 3;
                const intersectionsDown = raycasterDown.intersectObjects(scene.children, false);
                const validIntersectionsDown = intersectionsDown.find(intersect => intersect.object instanceof THREE.Mesh && intersect.face);
                const onObject = validIntersectionsDown !== undefined;

                const forward = new THREE.Vector3();
                fpCamera.getWorldDirection(forward);
                forward.y = 0;
                forward.normalize();
                const right = new THREE.Vector3();
                right.crossVectors(forward, fpCamera.up).normalize();
                const backward = forward.clone().negate();
                const left = right.clone().negate();
                const top = fpCamera.up.normalize();


                const bodyPos = playerPos.clone();
                bodyPos.y -= 0.5;
                const collisionDistance = 0.6;

                raycasterFront.set(bodyPos, forward);
                raycasterFront.far = collisionDistance;

                raycasterBack.set(bodyPos, backward);
                raycasterBack.far = collisionDistance;

                raycasterRight.set(bodyPos, right);
                raycasterRight.far = collisionDistance;

                raycasterLeft.set(bodyPos, left);
                raycasterLeft.far = collisionDistance;

                rayCasterTop.set(playerPos, top);
                rayCasterTop.far = collisionDistance;


                const isColliding = (raycaster) => {
                    return raycaster.intersectObjects(scene.children, false)
                        .some(intersect => intersect.object instanceof THREE.Mesh && intersect.face);
                };

                const colFront = isColliding(raycasterFront);
                const colBack = isColliding(raycasterBack);
                const colRight = isColliding(raycasterRight);
                const colLeft = isColliding(raycasterLeft);
                const colTop = isColliding(rayCasterTop);

                velocity.x -= velocity.x * 10.0 * delta;
                velocity.z -= velocity.z * 10.0 * delta;
                velocity.y -= 3 * 100.0 * delta; // 100.0 = mass

                localInput.x = Number(moveRight) - Number(moveLeft);
                localInput.z = Number(moveForward) - Number(moveBackward);
                localInput.normalize(); // this ensures consistent movements in all directions

                if (moveForward || moveBackward) velocity.z += localInput.z * 100.0 * delta;
                if (moveLeft || moveRight) velocity.x += localInput.x * 100.0 * delta;

                if (colFront && velocity.z > 0) velocity.z = 0;
                if (colBack  && velocity.z < 0) velocity.z = 0;
                if (colRight && velocity.x > 0) velocity.x = 0;
                if (colLeft  && velocity.x < 0) velocity.x = 0;
                if (colTop   && velocity.y > 0) velocity.y = 0;

                if (onObject)
                {
                    velocity.y = Math.max(0, velocity.y);
                    canJump = true;
                }

                fpControls.moveRight(velocity.x * delta);
                fpControls.moveForward(velocity.z * delta);

                fpControls.object.position.y += (velocity.y * delta);

                if (fpControls.object.position.y < raycasterFar)
                {
                    velocity.y = 0;
                    fpControls.object.position.y = raycasterFar;
                    canJump = true;
                }
            }
            else 
            {
                const playerHeight = 1.6;
                const playerRadius = 0.3;

                const checkCollision = (px, py, pz, yOffset, yHeight) => 
                {
                    const minX = Math.floor(px - playerRadius);
                    const maxX = Math.floor(px + playerRadius);
                    const minZ = Math.floor(pz - playerRadius);
                    const maxZ = Math.floor(pz + playerRadius);
                    const minY = Math.floor(py + yOffset);
                    const maxY = Math.floor(py + yHeight);

                    for (let y = minY; y <= maxY; y++) 
                    {
                        for (let z = minZ; z <= maxZ; z++)
                        {
                            for (let x = minX; x <= maxX; x++)
                            {
                                if (world.getVoxel(x, y, z) > 0) 
                                    return true;
                            }
                        }
                    }

                    return false;
                };

                velocity.x -= velocity.x * 10.0 * delta;
                velocity.z -= velocity.z * 10.0 * delta;
                velocity.y -= 3 * 100.0 * delta; // 100.0 = mass

                localInput.x = Number(moveRight) - Number(moveLeft);
                localInput.z = Number(moveForward) - Number(moveBackward);
                localInput.normalize(); // this ensures consistent movements in all directions

                if (localInput.x !== 0 || localInput.z !== 0)
                {
                    const forward = new THREE.Vector3();
                    fpControls.object.getWorldDirection(forward);
                    forward.y = 0;
                    forward.normalize();

                    const right = new THREE.Vector3();
                    right.crossVectors(forward, fpControls.object.up).normalize();

                    let moveDirX = (forward.x * localInput.z) + (right.x * localInput.x);
                    let moveDirZ = (forward.z * localInput.z) + (right.z * localInput.x);

                    const length = Math.sqrt(moveDirX * moveDirX + moveDirZ * moveDirZ);
                    if (length > 0)
                    {
                        moveDirX /= length;
                        moveDirZ /= length;
                    }

                    velocity.x += moveDirX * 70.0 * delta;
                    velocity.z += moveDirZ * 70.0 * delta;
                }

                /*/if (moveForward || moveBackward) velocity.z += direction.z * 100.0 * delta;
                if (moveLeft || moveRight) velocity.x += direction.x * 100.0 * delta;*/

                const nextX = playerPos.x + (velocity.x * delta);
                const nextY = playerPos.y + (velocity.y * delta);
                const nextZ = playerPos.z + (velocity.z * delta);

                if (checkCollision(nextX, playerPos.y, playerPos.z, -playerHeight + 0.1, 0))
                    velocity.x = 0;
                if (checkCollision(playerPos.x, playerPos.y, nextZ, -playerHeight + 0.1, 0))
                    velocity.z = 0;

                if (velocity.y < 0)
                {
                    if (checkCollision(playerPos.x, nextY, playerPos.z, -playerHeight, -playerHeight))
                    {
                        velocity.y = 0;
                        canJump = true;
                    }
                }
                else if (velocity.y > 0)
                {
                    if (checkCollision(playerPos.x, nextY, playerPos.z, 0.1, 0.1))
                        velocity.y = 0;
                }

                /*fpControls.moveRight(velocity.x * delta);
                fpControls.moveForward(velocity.z * delta);*/
                fpControls.object.position.x += velocity.x * delta;
                fpControls.object.position.z += velocity.z * delta;
                fpControls.object.position.y += (velocity.y * delta);

                if (fpControls.object.position.y < playerHeight)
                {
                    velocity.y = 0;
                    fpControls.object.position.y = playerHeight;
                    canJump = true;
                }

            }

            
        }

        prevTime = time;

        stats.update();

        if (postProcessingController.postProcessing === 'disabled')
            renderer.render(scene, activeCamera);
        else
            composer.render();

        requestAnimationFrame(render);
    }

    requestAnimationFrame(render);
    //#endregion
}

main();