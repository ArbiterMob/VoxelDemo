import * as THREE from 'three';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import Stats from "three/examples/jsm/libs/stats.module";
//import { initializeRendererControls } from './controls/renderer-control';
//import { initializeHelperControls } from './controls/helpers-control';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import * as UTILS from './utils.js';
import { randInt } from 'three/src/math/MathUtils.js';

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

    intersectRay(normalizedPosition, scene, camera)
    {
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(normalizedPosition, camera);

        const intersectedObject = raycaster.intersectObjects(scene.children);
        const intersection = intersectedObject.find(intersect => intersect.object instanceof THREE.Mesh && intersect.face);

        if (intersection)
        {
            const point = intersectedObject[0].point;
            const normal = intersectedObject[0].face.normal;

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
    const tileTextureWidth = 80;
    const tileTextureHeight = 64;
    const cellSize = 32;
    const world = new VoxelWorld({
        cellSize,
        tileSize,
        tileTextureWidth,
        tileTextureHeight,
    });

    const fov = 45;
    const aspect = 2;
    const near = 0.1;
    const far = 1000;
    const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
    camera.position.set(- cellSize * .3, cellSize * .8, - cellSize * .3);
    //camera.position.set(0, 10, 20);

    // TODO -> add a second camera !!!

    const controls = new OrbitControls(camera, canvas);
    controls.target.set(cellSize / 2, cellSize / 3, cellSize / 2);
	//controls.enableDamping = true;
    //controls.dampingFactor = 0.05;
    /*controls.minDistance = 3;
    controls.maxDistance = 10;*/
    //controls.minPolarAngle = Math.PI / 4;
    //controls.maxPolarAngle = (3 * Math.PI) / 4;
    
    //controls.target.set(0, 5, 0);
    controls.update();

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('lightblue');
    //scene.fog = new THREE.Fog('lightblue', scene.near, 50);
    //#endregion

    //#region LIGHT
    const color = 0xFFFFFF;
    const intensity = 3;
    const light = new THREE.DirectionalLight(color, intensity);
    light.position.set(45, 60, 40);
    light.target.position.set(16, 12, 16); // Point at the center of the world
    light.castShadow = true;

    light.shadow.camera.left = -30;
    light.shadow.camera.right = 30;
    light.shadow.camera.top = 30;
    light.shadow.camera.bottom = -30;
    light.shadow.camera.near = 0.1;
    light.shadow.camera.far = 100;
    light.shadow.mapSize.width = 4096;
    light.shadow.mapSize.height = 4096;

    light.shadow.normalBias = 0.02;
    light.shadow.bias = -0.0001;

    scene.add(light);
    scene.add(light.target);

    const ambientlight = new THREE.AmbientLight(0xFFFFFF, 0.35);
    scene.add(ambientlight);

    const lightHelper = new THREE.DirectionalLightHelper(light);
    scene.add(lightHelper);
    const shadowCameraHelper = new THREE.CameraHelper(light.shadow.camera);
    scene.add(shadowCameraHelper);
    //#endregion

    //#region MESH
    const loader = new THREE.TextureLoader();
    const texture = loader.load('./resources/atlas.png', render);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.colorSpace = THREE.SRGBColorSpace;
    
    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
            for (let y = 0; y < cellSize; y++) {
                for (let z = 0; z < cellSize; z++) {
                    for (let x = 0; x < cellSize; x++) {
                        const height = (Math.sin((j * cellSize + x) / cellSize * Math.PI * 2) + Math.sin((i * cellSize + z) / cellSize * Math.PI * 3)) * (cellSize / 6) + (cellSize / 2);
                        if (y < height) {
                            world.setVoxel(j*cellSize + x, y, i*cellSize + z, randInt(1, 5));
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
            //mesh.position.set(cellX * cellSize, cellY * cellSize, cellZ * cellSize);
        }
    }

    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
            /*const {positions, normals, uvs, indices} = world.generateGeometryDataForCell(j, 0, i);
            const geometry = new THREE.BufferGeometry();
            const material = new THREE.MeshLambertMaterial({
                map: texture,
                side: THREE.DoubleSide,
                /*alphaTest: 0.1,
                transparent: true,
            });

            const positionNumComponents = 3;
            const normalNumComponents = 3;
            const uvNumComponents = 2;
            geometry.setAttribute(
                'position',
                new THREE.BufferAttribute(new Float32Array(positions), positionNumComponents)
            );
            geometry.setAttribute(
                'normal',
                new THREE.BufferAttribute(new Float32Array(normals), normalNumComponents)
            );
            geometry.setAttribute(
                'uv',
                new THREE.BufferAttribute(new Float32Array(uvs), uvNumComponents)
            );
            geometry.setIndex(indices);
            const mesh = new THREE.Mesh(geometry, material);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            scene.add(mesh);*/
            updateCellGeometry(j * cellSize, 0, i * cellSize);
        }
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

    const gui = new GUI();
    //initializeRendererControls(gui, renderer);
    //initializeHelperControls(gui, scene);

    const lightFolder = gui.addFolder('Light');
    lightFolder.add(lightHelper, 'visible').name('showHelper');
    lightFolder.addColor(new UTILS.ColorGUIHelper(light, 'color'), 'value').name('color');
    lightFolder.add(light, 'intensity', 0, 5, 0.01);
    UTILS.makeXYZGUI(lightFolder, light.position, 'position', updateLight);
    UTILS.makeXYZGUI(lightFolder, light.target.position, 'target', updateLight);

    const shadowFolder = lightFolder.addFolder('Shadow Camera');
    shadowFolder.add(shadowCameraHelper, 'visible').name('showHelper');
    shadowFolder.add(new UTILS.DimensionGUIHelper(light.shadow.camera, 'left', 'right'), 'value', 1, 100)
        .name('width').onChange(updateLight);
    shadowFolder.add(new UTILS.DimensionGUIHelper(light.shadow.camera, 'bottom', 'top'), 'value', 1, 100)
        .name('height').onChange(updateLight);
    const shadowCameraMinMaxGUIHelper = new UTILS.MinMaxGUIHelper(light.shadow.camera, 'near', 'far', 0.1);
    shadowFolder.add(shadowCameraMinMaxGUIHelper, 'min', 0.1, 50, 0.1).name('near').onChange(updateLight);
    shadowFolder.add(shadowCameraMinMaxGUIHelper, 'max', 0.1, 1000, 0.1).name('far').onChange(updateLight);
    shadowFolder.add(light.shadow.camera, 'zoom', 0.01, 1.5, 0.01).onChange(updateLight);

    const cameraFolder = gui.addFolder('Camera');
    cameraFolder.add(camera, 'fov', 1, 180).onChange(updateCamera);
    const cameraMinMaxGUIHelper = new UTILS.MinMaxGUIHelper(camera, 'near', 'far', 0.1);
    cameraFolder.add(cameraMinMaxGUIHelper, 'min', 0.1, 50, 0.1).name('near').onChange(updateCamera);
    cameraFolder.add(cameraMinMaxGUIHelper, 'max', 0.1, 1000, 0.1).name('far').onChange(updateCamera);

    /*const fogFolder = gui.addFolder('Fog');
    const fogGUIHelper = new UTILS.FogGUIHelper(scene.fog, scene.background);
    fogFolder.add(fogGUIHelper, 'near', 1, 50).listen();
    fogFolder.add(fogGUIHelper, 'far', 1, 50).listen();
    fogFolder.addColor(fogGUIHelper, 'color');*/
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
        const pos = getCanvasRelativePosition(event);
        const x = (pos.x / canvas.width ) *  2 - 1;
        const y = (pos.y / canvas.height) * -2 + 1;

        const intersection = world.intersectRay({x, y}, scene, camera);
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
        if (mouse.moveX < 5 && mouse.moveY < 5)
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

    function render() {

        if (resizeRendererToDisplaySize(renderer)) {
            const canvas = renderer.domElement;
            camera.aspect = canvas.clientWidth / canvas.clientHeight;
            camera.updateProjectionMatrix();
        }


        stats.update();
        renderer.render(scene, camera);

        requestAnimationFrame(render);
    }

    requestAnimationFrame(render);
    //#endregion
}

main();