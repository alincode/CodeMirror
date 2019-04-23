// CodeMirror, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: https://codemirror.net/LICENSE

(function(mod) {
  if (typeof exports == "object" && typeof module == "object") // CommonJS
    mod(require("../../lib/codemirror"));
  else if (typeof define == "function" && define.amd) // AMD
    define(["../../lib/codemirror"], mod);
  else // Plain browser env
    mod(CodeMirror);
})(function(CodeMirror) {
"use strict";

  CodeMirror.defineMode("solidity", function (config) {
    var indentUnit = config.indentUnit;

    var functionKeyword = 'function';
    var functionNameKeyword = 'Name';
    var leftBracketSign = '(';
    var rightBracketSign = ')';
    var functionVariableName = 'variable';


    var keywords = {
      "contract": true, "function": true, "public": true, "pragma": true, "solidity": true,
      "struct": true, "mapping": true, 'modifier':true, "storage": true, "constructor": true,
      "view": true, "returns": true,
      "constant": true, 'library': true,
      "using": true, "external": true, "internal":true, "event":true, //internal pure
      "memory": true, "pure": true, "payable":true, //not sure
      "emit":true,
     
      // "case": true, "chan": true, "const": true,
      // "default": true, "defer": true,  "fallthrough": true,
      // "func": true, "go": true, "goto": true,  "import": true,
      // "interface": true, "package": true,
      // "select": true, "struct": true, "switch": true, "type": true, "var": true,
      // "complex64": true, "complex128": true,
      // "float32": true, "float64": true, 
      //    "uintptr": true, "error": true,
      // "rune": true
    };

    var keywordsEtherUnit = { 'wei': true, 'szabo': true, 'finney': true, 'ether': true };
    var keywordsTimeUnit = { 'seconds': true, 'minutes': true, 'hours': true, 'days': true, 'weeks': true };
    var keywordsBlockAndTransactionProperties = {
      ['block']: ['coinbase', 'difficulty', 'gaslimit', 'number','timestamp'],
      ['msg']: ['data', 'sender', 'sig', 'value'],
      ['tx']: ['gasprice', 'origin']
    };
    var keywordsMoreBlockAndTransactionProperties = { 'now': true, 'gasleft': true, 'blockhash': true }
    var keywordsErrorHandling = { 'assert': true, 'require': true, 'revert': true };
    var keywordsMathematicalAndCryptographicFuctions = {
      'addmod': true, 'mulmod': true, 'keccak256': true, 'sha256': true, 'ripemd160': true, 'ecrecover':true
    }
    var keywordsContractRelated = { 'this': true, 'selfdestruct': true };
    var keywordsTypeInformation = { 'type': true };

    var keywordsControlStructures = {
      'if': true, 'else': true, 'while': true, 'do': true, 'for': true, 'break': true, 'continue': true, 'return': true
    };

    var keywordsValueTypes = {//TO DO: correct version is from 8 to 256, need to auto generate it
      "bool": true, "byte": true, "string": true,
      "enum": true,
      "address": true,
    };

    var keywordsMembersOfAddressType = {
      ['address(this)']: ['balance', 'call', 'delegatecall', 'staticcall'],
      ['address payable']: ['transfer', 'send'],
    };

    // var functionStructureStage = [{
    //   function: ['function', 'returns']
    // },
    //   leftBracketSign,
    //   parameterName,
    //   parameterValue,
    //   rightBracketSign,
    // ];

    var atoms = {
      'delete': true, 'new': true, 
      "true": true, "false": true,

      //  "iota": true, "nil": true, "append": true,
      // "cap": true, "close": true, "complex": true, "copy": true, "imag": true,
      // "make": true,  "panic": true, "print": true,
      // "println": true, "real": true, "recover": true
    };

    var isOperatorChar = /[+\-*&^%:=<>!|\/]/;

    var curPunc;

    function tokenBase(stream, state) {
      var ch = stream.next();
      
      if (ch == '"' || ch == "'" || ch == "`") {
        state.tokenize = tokenString(ch);
        return state.tokenize(stream, state);
      }

      if (isVersion(stream, state)) return "version"
      
      if (/[\d\.]/.test(ch)) {
        if (ch == ".") {
          stream.match(/^[0-9]+([eE][\-+]?[0-9]+)?/);
        } else if (ch == "0") {
          stream.match(/^[xX][0-9a-fA-F]+/) || stream.match(/^0[0-7]+/);
        } else {
          stream.match(/^[0-9]*\.?[0-9]*([eE][\-+]?[0-9]+)?/);
        }
        return "number";
      }

      if (/[\[\]{}\(\),;\:\.]/.test(ch)) {
        return updateGarmmer(ch, state)      
      }
      if (ch == "/") {
        if (stream.eat("*")) {
          state.tokenize = tokenComment;
          return tokenComment(stream, state);
        }
        if (stream.eat("/")) {
          stream.skipToEnd();
          return "comment";
        }
      }
      if (isOperatorChar.test(ch)) {
        stream.eatWhile(isOperatorChar);
        return "operator";
      }
      stream.eatWhile(/[\w\$_\xa1-\uffff]/);
      
      var cur = stream.current();
      
      if (cur === 'solidity' && state.lastToken == 'pragma') {
        state.lastToken = state.lastToken + ' ' + cur;
      }

      
      if (keywords.propertyIsEnumerable(cur)) {
        if (cur == "case" || cur == "default") curPunc = "case";
        if (cur == 'pragma') state.lastToken = cur;
        if (cur == 'function') state.lastToken = 'function';
        if (cur == 'returns') state.lastToken = 'returns';
        if (cur == 'address') state.lastToken = 'address';
        return "keyword";
      }

      if (keywordsEtherUnit.propertyIsEnumerable(cur)) return "etherUnit";
      if (keywordsContractRelated.propertyIsEnumerable(cur)) return "contractRelated";
      if (keywordsControlStructures.propertyIsEnumerable(cur) || keywordsTypeInformation.propertyIsEnumerable(cur)) return "keyword";
      if (keywordsValueTypes.propertyIsEnumerable(cur) || keywordsTimeUnit.propertyIsEnumerable(cur)|| isValidInteger(cur) || isValidBytes(cur)) {
        state.lastToken = state.lastToken + "variable";
        return  "keyword"
      }  
  
      if (atoms.propertyIsEnumerable(cur)) return "atom";
      if (keywordsErrorHandling.propertyIsEnumerable(cur)) return 'errorHandling';

      if (keywordsMoreBlockAndTransactionProperties.propertyIsEnumerable(cur) || 
        (keywordsBlockAndTransactionProperties[cur] && keywordsBlockAndTransactionProperties[cur].some(function (item) { return stream.match(`.${item}`) }))) return "variable-2";

      if (state.lastToken == 'function') { state.lastToken = 'functionName'; return "functionName"; }

      if (state.lastToken == 'functionName(variable') {
        state.lastToken = 'functionName(';
          return "parameterValue";
      }  

      if (state.lastToken == 'returns(variable') {
        console.log('checking', cur);
        state.lastToken = 'returns(';
        return "parameterValue";
      }

      if (state.lastToken == 'address' && cur == 'payable') { state.lastToken = 'address payable' }; 

    return "variable";
  }

  function tokenString(quote) {
    return function(stream, state) {
      var escaped = false, next, end = false;
      while ((next = stream.next()) != null) {
        if (next == quote && !escaped) {end = true; break;}
        escaped = !escaped && quote != "`" && next == "\\";
      }
      if (end || !(escaped || quote == "`"))
        state.tokenize = tokenBase;
      return "string";
    };
  }

  function tokenComment(stream, state) {
    var maybeEnd = false, ch;
    while (ch = stream.next()) {
      if (ch == "/" && maybeEnd) {
        state.tokenize = tokenBase;
        break;
      }
      maybeEnd = (ch == "*");
    }
    return "comment";
  }
   
    function isVersion(stream, state) {     
      if (state.lastToken == 'pragma solidity') {
        state.lastToken = null;       
        return !state.startOfLine && stream.match(/[\^\>\=]+?[\s]*[0-9\.]+[\s]*[\<]?[\s]*[0-9\.]+/)
      };
    }
  
    function isValidInteger(token) {
      if (token.match(/^[u]?int/)) {
        if (token.indexOf('t')+1 == token.length) return true;
        var numberPart = token.substr(token.indexOf('t')+1 , token.length);
        return (numberPart % 8 === 0 && numberPart<=256)
      }
    }

    function isValidBytes(token) {
      if (token.match(/^bytes/)) {
        if (token.indexOf('s') + 1 == token.length) return true;
        var bytesPart = token.substr(token.indexOf('s') + 1, token.length);
        return (bytesPart <= 32)
      }
    }

    function updateGarmmer(ch, state) {
      if (ch == '(' && state.lastToken == 'functionName') { state.lastToken += ch; }
      if (ch == ')' && state.lastToken == 'functionName(') { state.lastToken = null; }

      if (ch == '(' && state.lastToken == 'returns') {
        console.log('=======>returns start');
        state.lastToken += ch;
      }

      if (ch == ')' && (state.lastToken == 'returns(' || state.lastToken == 'returns(variable')) {
        console.log('=======>returns end');
        state.lastToken = null;
      }

      if (ch == '(' && state.lastToken == 'address') {
        console.log('=======>address start');
        state.lastToken += ch;
      }

      if (ch == ')' && (state.lastToken == 'address(this')) {
        console.log('=======>address end');
      }
      curPunc = ch;
      return null;
    }    
    

  function Context(indented, column, type, align, prev) {
    this.indented = indented;
    this.column = column;
    this.type = type;
    this.align = align;
    this.prev = prev;
  }
  function pushContext(state, col, type) {
    return state.context = new Context(state.indented, col, type, null, state.context);
  }
  function popContext(state) {
    if (!state.context.prev) return;
    var t = state.context.type;
    if (t == ")" || t == "]" || t == "}")
      state.indented = state.context.indented;
    return state.context = state.context.prev;
  }

  // Interface

  return {
    startState: function (basecolumn) {
      return {
        tokenize: null,
        context: new Context((basecolumn || 0) - indentUnit, 0, "top", false),
        indented: 0,
        startOfLine: true
      };
    },

    token: function (stream, state) {
      var ctx = state.context;
      if (stream.sol()) {
        if (ctx.align == null) ctx.align = false;
        state.indented = stream.indentation();
        state.startOfLine = true;
        if (ctx.type == "case") ctx.type = "}";
      }
      if (stream.eatSpace()) return null;
      curPunc = null;
      var style = (state.tokenize || tokenBase)(stream, state);
      
      if (style == "comment") return style;
      if (ctx.align == null) ctx.align = true;

      if (curPunc == "{") pushContext(state, stream.column(), "}");
      else if (curPunc == "[") pushContext(state, stream.column(), "]");
      else if (curPunc == "(") pushContext(state, stream.column(), ")");
      else if (curPunc == "case") ctx.type = "case";
      else if (curPunc == "}" && ctx.type == "}") popContext(state);
      else if (curPunc == ctx.type) popContext(state);
      state.startOfLine = false;
      return style;
    },

    indent: function (state, textAfter) {
      console.log('------indent');
      if (state.tokenize != tokenBase && state.tokenize != null) return CodeMirror.Pass;
      var ctx = state.context, firstChar = textAfter && textAfter.charAt(0);
      if (ctx.type == "case" && /^(?:case|default)\b/.test(textAfter)) {
        state.context.type = "}";
        return ctx.indented;
      }
      var closing = firstChar == ctx.type;
      if (ctx.align) return ctx.column + (closing ? 0 : 1);
      else return ctx.indented + (closing ? 0 : indentUnit);
    },

    electricChars: "{}):",
    closeBrackets: "()[]{}''\"\"``",
    fold: "brace",
    blockCommentStart: "/*",
    blockCommentEnd: "*/",
    lineComment: "//"
  };
});

CodeMirror.defineMIME("text/x-solidity", "solidity");

});
