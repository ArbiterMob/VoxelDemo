//import * as THREE from 'three';

export class ColorGUIHelper
{
    constructor(object, prop)
    {
        this.object = object;
        this.prop = prop;
    }

    get value() 
    {
        return '#' + this.object[this.prop].getHexString();
    }

    set value(hexString)
    {
        this.object[this.prop].set(hexString);
    }
}

export class MinMaxGUIHelper
{
    constructor(obj, minProp, maxProp, minDif)
    {
        this.obj = obj;
        this.minProp = minProp;
        this.maxProp = maxProp;
        this.minDif = minDif;
    }

    get min()
    {
        return this.obj[this.minProp];
    }

    set min(v)
    {
        this.obj[this.minProp] = v;
        this.obj[this.maxProp] = Math.max(this.obj[this.maxProp], v + this.minDif);
    }

    get max()
    {
        return this.obj[this.maxProp];
    }

    set max(v)
    {
        this.obj[this.maxProp] = v;
        // eslint-disable-next-line no-self-assign
        this.min = this.min;    // this will call the min setter
    }
}

export class DimensionGUIHelper
{
    constructor(obj, minProp, maxProp)
    {
        this.obj = obj;
        this.minProp = minProp;
        this.maxProp = maxProp;
    }

    get value()
    {
        return this.obj[this.maxProp] * 2;
    }

    set value(v)
    {
        this.obj[this.maxProp] = v / 2;
        this.obj[this.minProp] = -v / 2;
    }
}

export class FogGUIHelper
{
    constructor(fog, backgroundColor)
    {
        this.fog = fog;
        this.backgroundColor = backgroundColor;
    }

    get near()
    {
        return this.fog.near;
    }

    set near(v)
    {
        this.fog.near = v;
        this.fog.far = Math.max(this.fog.far, v);
    }

    get far()
    {
        return this.fog.far;
    }

    set far(v)
    {
        this.fog.far = v;
        this.fog.near = Math.min(this.fog.near, v);
    }

    get color()
    {
        return `#${this.fog.color.getHexString()}`;
    }

    set color(hexString)
    {
        this.fog.color.set(hexString);
        this.backgroundColor.set(hexString);
    }
}

export function makeXYZGUI(gui, vector3, name, onChangeFn)
{
    const folder = gui.addFolder(name);
    folder.add(vector3, 'x', -100, 100).onChange(onChangeFn);
    folder.add(vector3, 'y', -100, 100).onChange(onChangeFn);
    folder.add(vector3, 'z', -100, 100).onChange(onChangeFn);
    folder.open();
}

/*export class PickHelper
{
    constructor()
    {
        this.raycaster = new THREE.Raycaster();
        this.pickedObject = null;
    }

    pick(normalizedPosition, scene, camera)
    {
        // cast a ray through the frustum
        this.raycaster.setFromCamera(normalizedPosition, camera);

        // get the list of objects the ray intersected
        const intersectedObject = this.raycaster.intersectObjects(scene.children);
        if (intersectedObject.length)
        {
            // pick the first object. It's the closest one
            this.pickedObject = intersectedObject[0].object;
            /*console.log('%%%%%');
            console.log(this.pickedObject);
            console.log(intersectedObject[0]);

            const point = intersectedObject[0].
        }
    }
}*/