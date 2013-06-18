/**
 * Mainly do the parse and compile of shader string
 * Support shader code chunk import and export
 * Support shader semantics
 * http://www.nvidia.com/object/using_sas.html
 * https://github.com/KhronosGroup/collada2json/issues/45
 *
 */
define( function(require){
    
    var Base = require("core/base"),
        glMatrix = require("glmatrix"),
        mat2 = glMatrix.mat2
        mat3 = glMatrix.mat3,
        mat4 = glMatrix.mat4,
        util = require("util/util"),
        _ = require("_");

    var uniformRegex = /uniform\s+(bool|float|int|vec2|vec3|vec4|ivec2|ivec3|ivec4|mat2|mat3|mat4|sampler2D|samplerCube)\s+(\w+)?(\[.*?\])?\s*(:\s*([\S\s]+?))?;/g;
    var attributeRegex = /attribute\s+(float|int|vec2|vec3|vec4)\s+(\w*)\s*(:\s*(\w+))?;/g;

    var uniformTypeMap = {
        "bool" : "1i",
        "int" : "1i",
        "sampler2D" : "t",
        "samplerCube" : "t",
        "float" : "1f",
        "vec2" : "2f",
        "vec3" : "3f",
        "vec4" : "4f",
        "ivec2" : "2i",
        "ivec3" : "3i",
        "ivec4" : "4i",
        "mat2" : "m2",
        "mat3" : "m3",
        "mat4" : "m4"
    }
    var uniformValueConstructor = {
        'bool' : function(){return true;},
        'int' : function(){return 0;},
        'float' : function(){return 0;},
        'sampler2D' : function(){return null;},
        'samplerCube' : function(){return null;},

        'vec2' : function(){return new Float32Array(2);},
        'vec3' : function(){return new Float32Array(3);},
        'vec4' : function(){return new Float32Array(4);},

        'ivec2' : function(){return new Int32Array(2);},
        'ivec3' : function(){return new Int32Array(3);},
        'ivec4' : function(){return new Int32Array(4);},

        'mat2' : function(){return mat2.create();},
        'mat3' : function(){return mat3.create();},
        'mat4' : function(){return mat4.create();},

        'array' : function(){return [];}
    }
    var availableSemantics = [
            'POSITION', 
            'NORMAL',
            'BINORMAL',
            'TANGENT',
            'TEXCOORD',
            'TEXCOORD_0',
            'TEXCOORD_1',
            'COLOR',
            'WORLD',
            'VIEW',
            'PROJECTION',
            'WORLDVIEW',
            'VIEWPROJECTION',
            'WORLDVIEWPROJECTION',
            'WORLDINVERSE',
            'VIEWINVERSE',
            'PROJECTIONINVERSE',
            'WORLDVIEWINVERSE',
            'VIEWPROJECTIONINVERSE',
            'WORLDVIEWPROJECTIONINVERSE',
            'WORLDTRANSPOSE',
            'VIEWTRANSPOSE',
            'PROJECTIONTRANSPOSE',
            'WORLDVIEWTRANSPOSE',
            'VIEWPROJECTIONTRANSPOSE',
            'WORLDVIEWPROJECTIONTRANSPOSE',
            'WORLDINVERSETRANSPOSE',
            'VIEWINVERSETRANSPOSE',
            'PROJECTIONINVERSETRANSPOSE',
            'WORLDVIEWINVERSETRANSPOSE',
            'VIEWPROJECTIONINVERSETRANSPOSE',
            'WORLDVIEWPROJECTIONINVERSETRANSPOSE'];
    
    var errorShader = {};

    // Enable attribute operation is global to all programs
    // Here saved the list of all enabled attribute index 
    // http://www.mjbshaw.com/2013/03/webgl-fixing-invalidoperation.html
    var enabledAttributeList = {};

    var Shader = Base.derive( function(){

        return {

            __GUID__ : util.genGUID(),

            vertex : "",
            
            fragment : "",

            precision : "mediump",
            // Properties follow will be generated by the program
            semantics : {},

            uniformTemplates : {},
            attributeTemplates : {},

            // Custom defined values in the shader
            vertexDefines : {},
            fragmentDefines : {},
            // Glue code
            // Defines the each type light number in the scene
            // AMBIENT_LIGHT
            // POINT_LIGHT
            // SPOT_LIGHT
            // AREA_LIGHT
            lightNumber : {},
            // {
            //  enabled : true
            //  shaderType : "vertex",
            // }
            _textureStatus : {},

            _vertexProcessed : "",
            _fragmentProcessed : "",

            _program : null,

        }
    }, function(){

        this.update();

    }, {

        setVertex : function(str){
            this.vertex = str;
            this.update();
        },
        setFragment : function(str){
            this.fragment = str;_caches
            this.update();
        },
        bind : function( _gl ){

            this.cache.use( _gl.__GUID__ , {
                "locations" : {},
                "attriblocations" : {}
            } );

            if( this.cache.get("dirty") || this.cache.miss("program") ){
                
                this._buildProgram( _gl, this._vertexProcessed, this._fragmentProcessed );
            
                this.cache.put("dirty", false);
            }

            _gl.useProgram( this.cache.get("program") );
        },
        // Overwrite the dirty method
        dirty : function(){
            for( var contextId in this.cache._caches){
                var context = this.cache._caches[contextId];
                context["dirty"] = true;
                context["locations"] = {};
                context["attriblocations"] = {};
            }
        },

        update : function( force ){

            if( this.vertex !== this._vertexPrev ||
                this.fragment !== this._fragmentPrev || force){

                this._parseImport();
                
                this.semantics = {};
                this._textureStatus = {};

                this._parseUniforms();
                this._parseAttributes();

                this._vertexPrev = this.vertex;
                this._fragmentPrev = this.fragment;
            }
            this._addDefine();

            this.dirty();
        },

        enableTexture : function( symbol, autoUpdate ){
            var status = this._textureStatus[ symbol ];
            if( status ){
                var isEnabled = status.enabled;
                if( isEnabled ){
                    // Do nothing
                    return;
                }else{
                    status.enabled = true;

                    var autoUpdate = typeof(autoUpdate)==="undefined" || true;
                    if(autoUpdate){
                        this.update();
                    }
                }
            }
        },

        enableTexturesAll : function(autoUpdate){
            for(var symbol in this._textureStatus){
                this._textureStatus[symbol].enabled = true;
            }

            var autoUpdate = typeof(autoUpdate)==="undefined" || true;
            if(autoUpdate){
                this.update();
            }
        },

        disableTexture : function( symbol, autoUpdate ){
            var status = this._textureStatus[ symbol ];
            if( status ){
                var isDisabled = ! status.enabled;
                if( isDisabled){
                    // Do nothing
                    return;
                }else{
                    status.enabled = false;

                    var autoUpdate = typeof(autoUpdate)==="undefined" || true;
                    if(autoUpdate){
                        this.update();
                    }
                }
            }
        },

        disableTexturesAll : function(symbol, autoUpdate){
            for(var symbol in this._textureStatus){
                this._textureStatus[symbol].enabled = false;
            }

            var autoUpdate = typeof(autoUpdate)==="undefined" || true;
            if(autoUpdate){
                this.update();
            }
        },

        setUniform : function( _gl, type, symbol, value ){

            var program = this.cache.get("program");            

            var locationsMap = this.cache.get( "locations" );
            var location = locationsMap[symbol];
            // Uniform is not existed in the shader
            if( location === null){
                return;
            }
            else if( ! location ){
                location = _gl.getUniformLocation( program, symbol );
                // Unform location is a WebGLUniformLocation Object
                // If the uniform not exist, it will return null
                if( location === null  ){
                    locationsMap[symbol] = null;
                    return;
                }
                locationsMap[symbol] = location;
            }
            switch( type ){
                case '1i':
                    _gl.uniform1i( location, value );
                    break;
                case '1f':
                    _gl.uniform1f( location, value );
                    break;
                case "1fv":
                    _gl.uniform1fv( location, value );
                    break;
                case "1iv":
                    _gl.uniform1iv( location, value );
                    break;
                case '2iv':
                    _gl.uniform2iv( location, value );
                    break;
                case '2fv':
                    _gl.uniform2fv( location, value );
                    break;
                case '3iv':
                    _gl.uniform3iv( location, value );
                    break;
                case '3fv':
                    _gl.uniform3fv( location, value );
                    break;
                case "4iv":
                    _gl.uniform4iv( location, value );
                    break;
                case "4fv":
                    _gl.uniform4fv( location, value );
                    break;
                case '2i':
                    _gl.uniform2i( location, value[0], value[1] );
                    break;
                case '2f':
                    _gl.uniform2f( location, value[0], value[1] );
                    break;
                case '3i':
                    _gl.uniform3i( location, value[0], value[1], value[2] );
                    break;
                case '3f':
                    _gl.uniform3f( location, value[0], value[1], value[2] );
                    break;
                case '4i':
                    _gl.uniform4i( location, value[0], value[1], value[2], value[3] );
                    break;
                case '4f':
                    _gl.uniform4f( location, value[0], value[1], value[2], value[3] );
                    break;
                case 'm2':
                    // The matrix must be created by glmatrix and can pass it directly.
                    _gl.uniformMatrix2fv(location, false, value);
                    break;
                case 'm3':
                    // The matrix must be created by glmatrix and can pass it directly.
                    _gl.uniformMatrix3fv(location, false, value);
                    break;
                case 'm4':
                    // The matrix must be created by glmatrix and can pass it directly.
                    _gl.uniformMatrix4fv(location, false, value);
                    break;
                case "m2v":
                    var size = 4;
                case "m3v":
                    var size = 9;
                case 'm4v':
                    var size = 16;
                    if( value instanceof Array){
                        var array = new Float32Array(value.length * size);
                        var cursor = 0;
                        for(var i = 0; i < value.length; i++){
                            var item = value[i];
                            for(var j = 0; j < item.length; j++){
                                array[cursor++] = item[j];
                            }
                        }
                        _gl.uniformMatrix4fv(location, false, array);
                    // Raw value
                    }else if( value instanceof Float32Array){   // ArrayBufferView
                        _gl.uniformMatrix4fv(location, false, value);
                    }
                    break;
            }
        },
        /**
         * Enable the attributes passed in and disable the rest
         * Example Usage:
         * enableAttributes( _gl, "position", "texcoords")
         * OR
         * enableAttributes(_gl, ["position", "texcoors"])
         */
        enableAttributes : function( _gl, attribList ){
            
            var program = this.cache.get("program");

            var locationsMap = this.cache.get("attriblocations");

            if( typeof(attribList) === "string"){
                attribList = Array.prototype.slice.call(arguments, 1);
            }

            var enabledAttributeListInContext = enabledAttributeList[_gl.__GUID__];
            if( ! enabledAttributeListInContext ){
                enabledAttributeListInContext = enabledAttributeList[_gl.__GUID__] = [];
            }

            for(var symbol in this.attributeTemplates){
                var location = locationsMap[symbol];                        
                if( typeof(location) === "undefined" ){
                    location = _gl.getAttribLocation( program, symbol );
                    // Attrib location is a number from 0 to ...
                    if( location === -1){
                        continue;
                    }
                    locationsMap[symbol] = location;
                }

                if(attribList.indexOf(symbol) >= 0){
                    if( ! enabledAttributeListInContext[location] ){
                        _gl.enableVertexAttribArray(location);
                        enabledAttributeListInContext[location] = true;
                    }
                }else{
                    if( enabledAttributeListInContext[location]){
                        _gl.disableVertexAttribArray(location);
                        enabledAttributeListInContext[location] = false;
                    }
                }
            }
        },

        setMeshAttribute : function( _gl, symbol, type, size ){
            var glType;
            switch( type ){
                case "byte":
                    glType = _gl.BYTE;
                    break;
                case "ubyte":
                    glType = _gl.UNSIGNED_BYTE;
                    break;
                case "short":
                    glType = _gl.SHORT;
                    break;
                case "ushort":
                    glType = _gl.UNSIGNED_SHORT;
                    break;
                default:
                    glType = _gl.FLOAT;
                    break;
            }

            var program = this.cache.get("program");            

            var locationsMap = this.cache.get("attriblocations");
            var location = locationsMap[symbol];

            if( typeof(location) === "undefined" ){
                location = _gl.getAttribLocation( program, symbol );
                // Attrib location is a number from 0 to ...
                if( location === -1){
                    return;
                }
                locationsMap[symbol] = location;
            }

            _gl.vertexAttribPointer( location, size, glType, false, 0, 0 );
        },

        _parseImport : function(){

            this._vertexProcessedWithoutDefine = Shader.parseImport( this.vertex );
            this._fragmentProcessedWithoutDefine = Shader.parseImport( this.fragment );

        },

        _addDefine : function(){

            // Add defines
            var defineStr = [];
            _.each( this.lightNumber, function(count, lightType){
                if( count ){
                    defineStr.push( "#define "+lightType.toUpperCase()+"_NUMBER "+count );
                }
            });
            _.each( this._textureStatus, function(status, symbol){
                if( status.enabled && status.shaderType === "vertex" ){
                    defineStr.push( "#define "+symbol.toUpperCase()+"_ENABLED" );
                }
            });
            // Custom Defines
            _.each( this.vertexDefines, function(value, symbol){
                if( value === null){
                    defineStr.push("#define "+symbol);
                }else{
                    defineStr.push("#define "+symbol+" "+value.toString());
                }
            } )
            this._vertexProcessed = defineStr.join("\n") + "\n" + this._vertexProcessedWithoutDefine;

            defineStr = [];
            _.each( this.lightNumber, function( count, lightType){
                if( count ){
                    defineStr.push( "#define "+lightType+"_NUMBER "+count );
                }
            });
            _.each( this._textureStatus, function( status, symbol){
                if( status.enabled && status.shaderType === "fragment" ){
                    defineStr.push( "#define "+symbol.toUpperCase()+"_ENABLED" );
                }
            });
            // Custom Defines
            _.each( this.fragmentDefines, function(value, symbol){
                if( value === null){
                    defineStr.push("#define "+symbol);
                }else{
                    defineStr.push("#define "+symbol+" "+value.toString());
                }
            } )
            var tmp = defineStr.join("\n") + "\n" + this._fragmentProcessedWithoutDefine;
            
            // Add precision
            this._fragmentProcessed = ['precision', this.precision, 'float'].join(' ')+';\n' + tmp;
        },

        _parseUniforms : function(){
            var uniforms = {},
                self = this;
            var shaderType = "vertex";
            this._vertexProcessedWithoutDefine = this._vertexProcessedWithoutDefine.replace( uniformRegex, _uniformParser );
            shaderType = "fragment";
            this._fragmentProcessedWithoutDefine = this._fragmentProcessedWithoutDefine.replace( uniformRegex, _uniformParser );

            function _uniformParser(str, type, symbol, isArray, semanticWrapper, semantic){
                if( type && symbol ){
                    var uniformType = uniformTypeMap[type];
                    var isConfigurable = true;
                    if( uniformType ){
                        if( type === "sampler2D" || type === "samplerCube" ){
                            // Texture is default disabled
                            self._textureStatus[symbol] = {
                                enabled : false,
                                shaderType : shaderType
                            };
                        }
                        if( isArray ){
                            uniformType += 'v';
                        }
                        if( semantic ){
                            if( availableSemantics.indexOf(semantic) < 0 ){
                                // The uniform is not configurable, which means it will not appear
                                // in the material uniform properties
                                if(semantic === "unconfigurable"){
                                    isConfigurable = false;
                                }else{
                                    var defaultValueFunc = self._parseDefaultValue( type, semantic );
                                    if( ! defaultValueFunc)
                                        console.warn('Unkown semantic "' + semantic + '"');
                                    else
                                        semantic = "";
                                }
                            }
                            else{
                                self.semantics[ semantic ] = {
                                    symbol : symbol,
                                    type : uniformType
                                }
                                isConfigurable = false;
                            }
                        }
                        if(isConfigurable){
                            uniforms[ symbol ] = {
                                type : uniformType,
                                value : isArray ? uniformValueConstructor['array'] : ( defaultValueFunc || uniformValueConstructor[ type ] ),
                                semantic : semantic || null
                            }
                        }
                    }
                    return ["uniform", type, symbol, isArray].join(" ")+";\n";
                }
            }

            this.uniformTemplates = uniforms;
        },

        _parseDefaultValue : function(type, str){
            var arrayRegex = /\[\s*(.*)\s*\]/
            if( type === "vec2" ||
                type === "vec3" ||
                type === "vec4"){
                var arrayStr = arrayRegex.exec(str)[1];
                if( arrayStr ){
                    var arr = arrayStr.split(/\s*,\s*/);
                    return function(){
                        return new Float32Array(arr);
                    }
                }else{
                    // Invalid value
                    return;
                }
            }
            else if( type === "bool" ){
                return function(){
                    return str.toLowerCase() === "true" ? true : false;
                }
            }
            else if( type === "float" ){
                return function(){
                    return parseFloat(str);
                }
            }
        },

        // Create a new uniform instance for material
        createUniforms : function(){
            var uniforms = {};
            
            _.each( this.uniformTemplates, function( uniformTpl, symbol ){
                uniforms[ symbol ] = {
                    type : uniformTpl.type,
                    value : uniformTpl.value()
                }
            } )

            return uniforms;
        },

        _parseAttributes : function(){
            var attributes = {},
                self = this;
            this._vertexProcessedWithoutDefine = this._vertexProcessedWithoutDefine.replace( attributeRegex, _attributeParser );

            function _attributeParser( str, type, symbol, semanticWrapper, semantic ){
                if( type && symbol ){
                    var size = 1;
                    switch( type ){
                        case "vec4":
                            size = 4;
                            break;
                        case "vec3":
                            size = 3;
                            break;
                        case "vec2":
                            size = 2;
                            break;
                        case "float":
                            size = 1;
                            break;
                    }

                    attributes[ symbol ] = {
                        // Force float
                        type : "float",
                        size : size,
                        semantic : semantic || null
                    }

                    if( semantic ){
                        if( availableSemantics.indexOf(semantic) < 0 ){
                            console.warn('Unkown semantic "' + semantic + '"');
                        }else{
                            self.semantics[ semantic ] = {
                                symbol : symbol,
                                type : type
                            }
                        }
                    }
                }

                return ["attribute", type, symbol].join(" ")+";\n";
            }

            this.attributeTemplates = attributes;
        },

        _buildProgram : function(_gl, vertexShaderString, fragmentShaderString){

            if( this.cache.get("program") ){
                _gl.deleteProgram( this.cache.get("program") );
            }
            var program = _gl.createProgram();

            try{

                var vertexShader = this._compileShader(_gl, "vertex", vertexShaderString);
                var fragmentShader = this._compileShader(_gl, "fragment", fragmentShaderString);
                _gl.attachShader( program, vertexShader );
                _gl.attachShader( program, fragmentShader );

                _gl.linkProgram( program );

                if ( !_gl.getProgramParameter( program, _gl.LINK_STATUS ) ) {
                    throw new Error( "Could not initialize shader\n" + "VALIDATE_STATUS: " + _gl.getProgramParameter( program, _gl.VALIDATE_STATUS ) + ", gl error [" + _gl.getError() + "]" );
                }
            }catch(e){
                if( errorShader[ this.__GUID__] ){
                    return;
                }
                errorShader[ this.__GUID__ ] = this;
                throw e; 
            }

            _gl.deleteShader( vertexShader );
            _gl.deleteShader( fragmentShader );

            this.cache.put("program", program);
        },

        _compileShader : function(_gl, type, shaderString){
            var shader = _gl.createShader( type === "fragment" ? _gl.FRAGMENT_SHADER : _gl.VERTEX_SHADER );
            _gl.shaderSource( shader, shaderString );
            _gl.compileShader( shader );

            if ( !_gl.getShaderParameter( shader, _gl.COMPILE_STATUS ) ) {
                throw new Error( [_gl.getShaderInfoLog( shader ),
                                    addLineNumbers(shaderString) ].join("\n") );
            }
            return shader;
        },

        dispose : function(){
            
        }
    });
        
    // some util functions
    function addLineNumbers( string ){
        var chunks = string.split( "\n" );
        for ( var i = 0, il = chunks.length; i < il; i ++ ) {
            // Chrome reports shader errors on lines
            // starting counting from 1
            chunks[ i ] = ( i + 1 ) + ": " + chunks[ i ];
        }
        return chunks.join( "\n" );
    }

    var importRegex = /(@import)\s*([0-9a-zA-Z_\-\.]*)/g;
    Shader.parseImport = function( shaderStr ){
        shaderStr = shaderStr.replace( importRegex, function(str, importSymbol, importName ){
            if( _source[importName] ){
                // Recursively parse
                return Shader.parseImport( _source[ importName ] );
            }
        } )
        return shaderStr;
    }

    var exportRegex = /(@export)\s*([0-9a-zA-Z_\-\.]*)\s*\n([\s\S]*?)@end/g;
    // Import the shader to library and chunks
    Shader.import = function( shaderStr ){

        shaderStr.replace( exportRegex, function(str, exportSymbol, exportName, code){
            _source[ exportName ] = code;
            return code;
        } )
    }

    // Library to store all the loaded shader strings
    var _source = {};

    Shader.source = function( name ){
        var shaderStr = _source[name];
        if( ! shaderStr ){
            console.error( 'Shader "' + name + '" not existed in library');
            return;
        }
        return shaderStr;
    }

    return Shader;
} )