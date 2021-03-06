define(function(require) {

    var Texture = require('../Texture');
    var WebGLInfo = require('../WebGLInfo');

    var Texture2D = Texture.derive({
        
        image : null,

        pixels : null,
    }, {
        update : function(_gl) {

            _gl.bindTexture(_gl.TEXTURE_2D, this.cache.get("webgl_texture"));
            
            this.beforeUpdate( _gl);

            var glFormat = this.format;
            var glType = this.type;

            _gl.texParameteri(_gl.TEXTURE_2D, _gl.TEXTURE_WRAP_S, this.wrapS);
            _gl.texParameteri(_gl.TEXTURE_2D, _gl.TEXTURE_WRAP_T, this.wrapT);

            _gl.texParameteri(_gl.TEXTURE_2D, _gl.TEXTURE_MAG_FILTER, this.magFilter);
            _gl.texParameteri(_gl.TEXTURE_2D, _gl.TEXTURE_MIN_FILTER, this.minFilter);
            
            var anisotropicExt = WebGLInfo.getExtension(_gl, "EXT_texture_filter_anisotropic");
            if (anisotropicExt && this.anisotropic > 1) {
                _gl.texParameterf(_gl.TEXTURE_2D, anisotropicExt.TEXTURE_MAX_ANISOTROPY_EXT, this.anisotropic);
            }

            if (this.image) {
                _gl.texImage2D(_gl.TEXTURE_2D, 0, glFormat, glFormat, glType, this.image);
            }
            // Can be used as a blank texture when writing render to texture(RTT)
            else {
                _gl.texImage2D(_gl.TEXTURE_2D, 0, glFormat, this.width, this.height, 0, glFormat, glType, this.pixels);
            }           
        
            if (! this.NPOT && this.useMipmap) {
                _gl.generateMipmap(_gl.TEXTURE_2D);
            }
            
            _gl.bindTexture(_gl.TEXTURE_2D, null);

        },
        generateMipmap : function(_gl) {
            _gl.bindTexture(_gl.TEXTURE_2D, this.cache.get("webgl_texture"));
            _gl.generateMipmap(_gl.TEXTURE_2D);    
        },
        isPowerOfTwo : function() {
            if (this.image) {
                var width = this.image.width,
                    height = this.image.height;   
            } else {
                var width = this.width,
                    height = this.height;
            }
            return (width & (width-1)) === 0 &&
                    (height & (height-1)) === 0;
        },

        isRenderable : function() {
            if (this.image) {
                return this.image.nodeName === "CANVAS" ||
                        this.image.complete;
            } else {
                return this.width && this.height;
            }
        },

        bind : function(_gl) {
            _gl.bindTexture(_gl.TEXTURE_2D, this.getWebGLTexture(_gl));
        },
        unbind : function(_gl) {
            _gl.bindTexture(_gl.TEXTURE_2D, null);
        },
        load : function(src) {
            var image = new Image();
            var self = this;
            image.onload = function() {
                self.dirty();
                self.trigger("load");
                image.onload = null;
            }
            image.src = src;
            this.image = image;
        }
    })

    return Texture2D;
})