//import * as THREE from 'three';

export function createCharacter(scene, sourceRoot, position) 
{
    const character = sourceRoot;
    character.position.set(position[0], position[1], position[2]);

    character.traverse((child) => {
        if (child.isMesh) 
        {
            child.castShadow = true;
            child.receiveShadow = true;
            if (!child.geometry.attributes.normal)
            {
                child.geometry.computeVertexNormals();
            }
        }
    });

    scene.add(character);

    const rat = {
        root: character,
    };

    return rat;
}