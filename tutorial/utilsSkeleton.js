import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

export function createSkeleton(scene, sourceRoot, animations, position) 
{
    const character = SkeletonUtils.clone(sourceRoot);
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

    const characterMixer = new THREE.AnimationMixer(character);
    const idleAction = characterMixer.clipAction(animations[0]);
    const walkAction = characterMixer.clipAction(animations[1]);
        
    const skeletonHelper = new THREE.SkeletonHelper(character.getObjectByName('rig'));
    skeletonHelper.visible = false;
    scene.add(skeletonHelper);

    const skel = {
        root: character,
        mixer: characterMixer,
        helper: skeletonHelper,
        idleAction,
        walkAction,
        idleWeight: 1,
        walkWeight: 0,
        crossFadeControls: [],
        
        // this is just for utility
        actions: {
            'Idle': idleAction,
            'Walk': walkAction,
        },
    };

    skel.animationSettings = {
        'show skeleton': false,
        'from walk to idle': () => prepareCrossFade(skel, walkAction, idleAction, 1.0),
        'from idle to walk': () => prepareCrossFade(skel, idleAction, walkAction, 0.5),
        'use default duration': true,
        'set custom duration': 3.5,
        'modify idle weight': 1.0,
        'modify walk weight': 0.0,
        'modify time scale': 1.0,
    };

    setWeight(idleAction, skel.animationSettings['modify idle weight']);
    setWeight(walkAction, skel.animationSettings['modify walk weight']);
    idleAction.play();
    walkAction.play();

    return skel;
}

export function createHammer(scene, sourceRoot, animations, position) 
{
    const character = SkeletonUtils.clone(sourceRoot);
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

    const characterMixer = new THREE.AnimationMixer(character);
    const idleAction = characterMixer.clipAction(animations[0]);
    const walkAction = characterMixer.clipAction(animations[1]);

    const hammer = {
        root: character,
        mixer: characterMixer,
        idleAction,
        walkAction,
    };

    setWeight(idleAction, 1);
    setWeight(walkAction, 0);
    idleAction.play();
    walkAction.play();

    return hammer;
}

export function createChest(scene, sourceRoot, animations, position) 
{
    const character = sourceRoot.clone();
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

    const characterMixer = new THREE.AnimationMixer(character);
    const openAction = characterMixer.clipAction(animations[0]);
    openAction.setLoop(THREE.LoopOnce, 1);
    openAction.clampWhenFinished = true;

    const chest = {
        root: character,
        mixer: characterMixer,
        openAction,
        isOpen: false,
    };

    setWeight(openAction, 1);

    return chest;
}

export function prepareCrossFade(skel, startAction, endAction, defaultDuration, synch = true)
{
    const duration = setCrossFadeDuration(skel.animationSettings, defaultDuration);

    skel.idleAction.paused = false;
    skel.walkAction.paused = false;

    if (synch === true)
    {
        if (startAction === skel.idleAction)
        {
            executeCrossFade(startAction, endAction, duration);
        }
        else
        {
            synchronizeCrossFade(skel.mixer, startAction, endAction, duration);
        }
    }
    else 
    {
        executeCrossFade(startAction, endAction, duration);
    }
    
}

export function setCrossFadeDuration(animationSettings, defaultDuration)
{
    if (animationSettings['use default duration'])
    {
        return defaultDuration;
    }
    else 
    {
        return animationSettings['set custom duration'];
    }
}

export function synchronizeCrossFade(mixer, startAction, endAction, duration)
{
    mixer.addEventListener('loop', (onLoopFinished));

    function onLoopFinished(event)
    {
        if (event.action === startAction)
        {
            mixer.removeEventListener('loop', onLoopFinished);
            executeCrossFade(startAction, endAction, duration);
        }
    }
}

export function executeCrossFade(startAction, endAction, duration)
{
    setWeight(endAction, 1);
    endAction.time = 0;
    startAction.crossFadeTo(endAction, duration, true);
}

export function setWeight(action, weight)
{
    action.enabled = true;
    action.setEffectiveTimeScale(1);
    action.setEffectiveWeight(weight);
}

export function activateAllActions(skel)
{
    setWeight(skel.idleAction, skel.animationSettings['modify idle weight']);
    setWeight(skel.walkAction, skel.animationSettings['modify walk weight']);

    skel.idleAction.play();
    skel.walkAction.play();
}