define(function(require) {

    var Node = require('./node');

    var Layer = Node.derive(function() {
        return {
            canvas : null,

            ctx : null,
            
            width : 0,
            
            height : 0,
            
            clearColor : ''
        }
    }, function() {
        if (!this.canvas) {
            this.canvas = document.createElement('canvas');
        }

        if (this.width) {
            this.canvas.width = this.width;
        } else {
            this.width = this.canvas.width;
        }
        if (this.height) {
            this.canvas.height = this.height;
        } else {
            this.height = this.canvas.height;
        }

        this.canvas.style.zIndex = this.z;

        this.ctx = this.canvas.getContext('2d');

        this.ctx.__GUID__ = this.__GUID__;
    }, {
        resize : function(width, height) {
            this.canvas.width = width;
            this.canvas.height = height;

            this.width = width;
            this.height = height;
        },

        render : function() {
            if (this.clearColor) {
                this.ctx.fillStyle = this.clearColor;
                this.ctx.fillRect(0, 0, this.width, this.height);
            } else {
                this.ctx.clearRect(0, 0, this.width, this.height);
            }

            Node.prototype.render.call(this, this.ctx);
        },

        setZ : function(z) {
            this.z = z;
            this.canvas.style.zIndex = z;
        }
    });

    return Layer;
} )