import * as THREE from 'three';

export function createCharacter(scene, sourceRoot, position, onlyFrontFaces = false) 
{
    const character = sourceRoot.clone();
    character.position.set(position[0], position[1], position[2]);

    character.traverse((child) => {
        if (child.isMesh) 
        {
            child.castShadow = true;
            child.receiveShadow = true;
            /*if (!child.geometry.attributes.normal)
            {
                child.geometry.computeVertexNormals();
            }*/

            if (onlyFrontFaces === true)
            {
                child.material.side = THREE.FrontSide;
                child.material.needsUpdate = true;
            }
        }
    });

    scene.add(character);

    const char = {
        root: character,
    };

    return char;
}

export function createCurve(controlPoints)
{
    const p0 = new THREE.Vector3();
    const p1 = new THREE.Vector3();
    const curve = new THREE.CatmullRomCurve3(
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
    
    const points = curve.getPoints(250);
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({color: 0xff0000});
    const curveObject = new THREE.Line(geometry, material);
    //curveObject.position.set(-5, 0, 0);
    //scene.add(curveObject);
    
    return {
        curve,
        curveObject,
    };
}


const objectPosition = new THREE.Vector3();
const objectTarget = new THREE.Vector3();
export function updateObjectsOnCurve(curve, curveObject, objects, elapsed, scale)
{
    const pathTime = elapsed * scale;
    const targetOffset = 0.01;
    for (let i = 0; i < objects.length; i++) 
    {
        const mesh = objects[i];

        // a number between 0 and 1 to evenly space the objects
        const u = pathTime + i / objects.length;

        // get the first point
        curve.getPointAt(u % 1, objectPosition);
        objectPosition.applyMatrix4(curveObject.matrixWorld);

        // get a second point slightly further down the curve
        curve.getPointAt((u + targetOffset) % 1, objectTarget);
        objectTarget.applyMatrix4(curveObject.matrixWorld);

        // put the object at the first point (temporarily)
        mesh.position.copy(objectPosition);
        // point the object to the second point
        mesh.lookAt(objectTarget);

        // put the object between the 2 points
        mesh.position.lerpVectors(objectPosition, objectTarget, 0.5);
    }
}

export function updateObjectOnCurve(curve, curveObject, object, elapsed, scale)
{
    const pathTime = elapsed * scale;
    const targetOffset = 0.01;

    const mesh = object;

    // a number between 0 and 1 to evenly space the objects
    const u = pathTime;

    // get the first point
    curve.getPointAt(u % 1, objectPosition);
    objectPosition.applyMatrix4(curveObject.matrixWorld);

    // get a second point slightly further down the curve
    curve.getPointAt((u + targetOffset) % 1, objectTarget);
    objectTarget.applyMatrix4(curveObject.matrixWorld);

    // put the object at the first point (temporarily)
    mesh.position.copy(objectPosition);
    // point the object to the second point
    mesh.lookAt(objectTarget);

    // put the object between the 2 points
    mesh.position.lerpVectors(objectPosition, objectTarget, 0.5);
}