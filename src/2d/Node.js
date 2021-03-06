/**
 * Node of the scene tree
 * And it is the base class of all elements
 */
define(function(require) {
    
    var Base = require("core/Base");
    var Vector2 = require("core/Vector2");
    var Matrix2d = require("core/Matrix2d");
    var Style = require("./Style");
    var util = require("util/util");

    var Node = Base.derive(function() {
        return {

            __GUID__ : util.genGUID(),
            
            name : '',
            
            //Axis Aligned Bounding Box
            boundingBox : {
                min : new Vector2(),
                max : new Vector2()
            },
            // z index
            z : 0,
            
            style : null,
            
            position : new Vector2(0, 0),
            rotation : 0,
            scale : new Vector2(1, 1),

            autoUpdate : true,
            transform : new Matrix2d(),
            // inverse matrix of transform matrix
            transformInverse : new Matrix2d(),
            _prevRotation : 0,

            // visible flag
            visible : true,

            _children : [],
            // virtual width of the stroke line for intersect
            intersectLineWidth : 0,

            // Clip flag
            // If it is true, this element can be used as a mask
            // and all the children will be clipped in its shape
            //
            // TODO: add an other mask flag to distinguish with the clip?
            clip : false,

            // flag of fill when drawing the element
            fill : true,
            // flag of stroke when drawing the element
            stroke : false,
            // Enable picking
            enablePicking : true
        }
    }, {
        updateTransform : function() {
            var transform = this.transform;
            if (! this.scale._dirty &&
                ! this.position._dirty &&
                this.rotation === this._prevRotation) {
                return;
            }
            if (! this.autoUpdate) {
                return;
            }
            transform.identity();
            transform.scale(this.scale);
            transform.rotate(this.rotation);
            transform.translate(this.position);

            this._prevRotation = this.rotation;
        },
        updateTransformInverse : function() {
            this.transformInverse.copy(this.transform).invert();
        },
        // intersect with the bounding box
        intersectBoundingBox : function(x, y) {
            var boundingBox = this.boundingBox;
            return  (boundingBox.min.x < x && x < boundingBox.max.x) && (boundingBox.min.y < y && y< boundingBox.max.y);
        },
        add : function(elem) {
            if (elem) {
                this._children.push(elem);
                if (elem.parent) {
                    elem.parent.remove(elem);
                }
                elem.parent = this;
            }
        },
        remove : function(elem) {
            if (elem) {
                this._children.splice(this._children.indexOf(elem), 1);
                elem.parent = null;
            }
        },
        children : function() {
            // get a copy of children
            return this._children.slice();
        },
        childAt : function(idx) {
            return this._children[idx];
        },
        draw : null,

        render : function(context) {
            
            this.trigger("beforerender", [context]);

            var renderQueue = this.getSortedRenderQueue();
            // TODO : some style should not be inherited ?
            context.save();
            if (this.style) {
                if (!this.style instanceof Array) {
                    for (var i = 0; i < this.style.length; i++) {
                        this.style[i].bind(context);
                    }
                } else if(this.style.bind) {
                    this.style.bind(context);
                }
            }
            this.updateTransform();
            var m = this.transform._array;
            context.transform(m[0], m[1], m[2], m[3], m[4], m[5]);

            if (this.draw) {
                this.trigger("beforedraw", [context]);
                this.draw(context);
                this.trigger("afterdraw", [context]);
            }

            //clip from current path;
            this.clip && context.clip();

            for (var i = 0; i < renderQueue.length; i++) {
                renderQueue[i].render(context);
            }
            context.restore();

            this.trigger("afterrender", [context]);
        },

        traverse : function(callback) {
            var stopTraverse = callback && callback(this);
            if (! stopTraverse) {
                var children = this._children;
                for (var i = 0, len = children.length; i < len; i++) {
                    children[i].traverse(callback);
                }
            }
        },

        intersect : function(x, y, eventName) {},

        // Get transformed bounding rect
        getBoundingRect : function() {

            return {
                left : null,
                top : null,
                width : null,
                height : null
            }
        },

        getWidth : function() {
            
        },

        getHeight : function() {
            
        },

        getSortedRenderQueue : function() {
            var renderQueue = this._children.slice();
            renderQueue.sort(function(x, y) {
                if (x.z === y.z)
                    return x.__GUID__ > y.__GUID__ ? 1 : -1;
                return x.z > y.z ? 1 : -1 ;
            });
            return renderQueue; 
        }
    })

    return Node;
})