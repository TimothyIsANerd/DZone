'use strict';
var util = require('dz-util');
var WorldGeneration = require('./generation');
var WorldGraphics = require('world/graphics');
var EntityMap = require('./entitymap');
var EntityManager = require('man-entity');
var ComponentManager = require('man-component');
var SpriteManager = require('man-sprite');
var worldConfig = require('./config');
var PathManager = require('./path/pathmanager');

var world, collisionMap, transformData;

var worldManager = {
    generateWorld(size) {
        transformData = ComponentManager.getComponentData([require('com-transform')])[0];
        world = WorldGeneration.generateMap(size);
        worldManager.world = world;
        collisionMap = world.collisionMap;
        PathManager.init(collisionMap);
        addEntity(EntityManager.addEntity([
            [require('com-transform'), { platform: false }],
            [require('com-sprite3d'), worldConfig().beacon]
        ]));
        SpriteManager.waitForLoaded(function() {
            WorldGraphics.drawWorld(world, SpriteManager.sheets);
            require('sys-render').setWorld(world);
        });
    },
    addEntity: addEntity,
    removeEntity: removeEntity,
    getSurfaceZ(x, y, z, maxDown, maxUp) {
        x = center(x);
        y = center(y);
        var closest = -100;
        for(var i = Math.max(0, z - maxDown); i <= Math.min(63, z + maxUp); i++) {
            if((collisionMap.getXYZ(x, y, i) & 3) == 1) { // Does this Z have a platform and no solid block?
                if(i === z) return z; // Same Z preferred
                if(Math.abs(i - closest) >= Math.abs(i - z)) closest = i; // Get closest Z
            }
        }
        return closest;
    },
    moveEntity(e, x, y, z) {
        var transform = removeEntity(e);
        transform.x += x;
        transform.y += y;
        transform.z += z;
        addEntity(e);
    },
    getPath(e, sx, sy, sz, dx, dy, dz, maxDown, maxUp, cb) {
        removeEntity(e); // Remove entity from map so it doesn't interfere with its own pathing
        PathManager.getPath(e, sx, sy, sz, dx, dy, dz, maxDown, maxUp, function(path) {
            addEntity(e); // Add entity back to map before callback
            cb(path);
        });
    },
    center, unCenter
};

function addEntity(e) {
    var transform = getTransform(e);
    var centeredX = center(transform.x),
        centeredY = center(transform.y);
    transform.mapIndex = EntityMap.map.indexFromXYZ(centeredX, centeredY, transform.z);
    EntityMap.addEntity(transform.mapIndex, e);
    if(transform.solid) collisionMap.setIndex(transform.mapIndex, collisionMap.getIndex(transform.mapIndex) | 2);
    if(transform.platform) collisionMap.setIndex(transform.mapIndex, collisionMap.getIndex(transform.mapIndex, 1) | 1, 1);
    return transform;
}

function removeEntity(e) {
    var transform = getTransform(e);
    var remainingEntities = EntityMap.removeEntity(transform.mapIndex, e);
    var removeSolid = transform.solid;
    var removePlatform = transform.platform;
    if(remainingEntities && (removePlatform || removeSolid)) { // If at least one entity remains
        for(var i = 0; i < remainingEntities.length; i++) {
            var remainingTransform = getTransform(remainingEntities[i]);
            if(remainingTransform.solid) removeSolid = false;
            if(remainingTransform.platform) removePlatform = false;
        }
    }
    if(removeSolid) collisionMap.setIndex(transform.mapIndex, collisionMap.getIndex(transform.mapIndex) & ~2);
    if(removePlatform) collisionMap.setIndex(transform.mapIndex, collisionMap.getIndex(transform.mapIndex, 1) & ~1, 1);
    return transform;
}

function getTransform(e) {
    return transformData[e] || {};
}

function center(n) {
    return (n || 0) + world.radius;
}

function unCenter(n) {
    return (n || 0) - world.radius;
}

module.exports = worldManager;