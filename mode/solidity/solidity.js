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
    var keyWordContract = 'contract';


    var keywords = {
      'pragma': true, 'solidity': true, 'import': true, 'as': true, 'from': true,
      'contract': true, 'constructor': true, 'is': true,
      'function': true, 'modifier': true,
      // modifiers
      'pure': true, 'view': true, 'payable': true, 'constant': true, 'anonymous': true, 'indexed': true, 
      'returns': true, 'return': true,
      'event': true, 
      'struct': true, 'mapping': true,
      'interface': true,
      'using': true, 'library': true,
      'storage': true, 'memory': true, 'calldata': true,
      'public': true, 'private': true, 'external': true, 'internal': true,
      'emit': true,
      'assembly': true,
      'abstract': true, 'after': true, 'catch': true, 'final': true, 'in': true, 'inline': true, 'let': true, 'match': true, 'null': true, 'of': true, 'relocatable': true, 'static': true, 'try': true, 'typeof':true,
      'var': true,
    };

    var keywordsSpecial = {
      'pragma': true, 'returns': true ,'address':true,'contract': true,"function": true,'struct':true
    };

    var keywordsEtherUnit = { 'wei': true, 'szabo': true, 'finney': true, 'ether': true };
    var keywordsTimeUnit = { 'seconds': true, 'minutes': true, 'hours': true, 'days': true, 'weeks': true };
    var keywordsBlockAndTransactionProperties = {
      ['block']: ['coinbase', 'difficulty', 'gaslimit', 'number','timestamp'],
      ['msg']: ['data', 'sender', 'sig', 'value'],
      ['tx']: ['gasprice', 'origin']
    };
    var keywordsMoreBlockAndTransactionProperties = { 'now': true, 'gasleft': true, 'blockhash': true }
    var keywordsErrorHandling = { 'assert': true, 'require': true, 'revert': true,'throw':true };
    var keywordsMathematicalAndCryptographicFuctions = {
      'addmod': true, 'mulmod': true, 'keccak256': true, 'sha256': true, 'ripemd160': true, 'ecrecover':true
    }
    var keywordsContractRelated = { 'this': true, 'selfdestruct': true, 'super':true };
    var keywordsTypeInformation = { 'type': true };
    var keywordsContractList = {};

    var keywordsControlStructures = {
      'if': true, 'else': true, 'while': true, 'do': true, 'for': true, 'break': true, 'continue': true, 'switch': true, "case": true, 'default': true,
    };

    var keywordsValueTypes = {
      "bool": true, "byte": true, "string": true,
      "enum": true,
      "address": true,
    };

    var keywordsV0505NewReserve = {
      'alias': true, 'apply': true, 'auto': true, 'copyof': true, 'define': true, 'immutable': true, 'implements': true, 'macro': true, 'mutable': true, 'override': true, 'partial': true, 'promise': true, 'reference': true, 'sealed': true, 'sizeof': true, 'supports': true, 'typedef': true , 'unchecked': true
    }

    var keywordsAbiEncodeDecodeFunctions = {
      ['abi']: ['decode', 'encodePacked', 'encodeWithSelector', 'encodeWithSignature', 'encode']
    };
    var keywordsMembersOfAddressType = 
      ['transfer', 'send','balance', 'call', 'delegatecall', 'staticcall']
    ;

    var natSpecTags = ['title', 'author', 'notice', 'dev', 'param','return'];

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

    var isOperatorChar = /[+\-*&^%:=<>!|\/~]/;
    var isNegativeChar = /[-]/;
 

    var curPunc;
    
    function tokenBase(stream, state) {
      var ch = stream.next();
     
      
      if (ch == '"' || ch == "'" || ch == "`") {
        state.tokenize = tokenString(ch);
        return state.tokenize(stream, state);
      }

      if (isVersion(stream, state)) return "version"

      if (ch == '.' && keywordsMembersOfAddressType.some(function (item) { return stream.match(`${item}`) })) return 'addressFunction';  

      if (isNumber(ch, stream)) return 'number';

      if (/[\[\]{}\(\),;\:\.]/.test(ch)) {
        return updateGarmmer(ch, state)      
      }

      if (ch == "/") {
        if (stream.eat("*")) {
          state.tokenize = tokenComment;
          return tokenComment(stream, state);
        }
        if (stream.match(/\/{2}/)) {
          while (ch = stream.next()) {
            if (ch == "@") {
              stream.backUp(1);
              state.grammar = 'doc'
              break;
            }
          }
          return "doc";
        }

        if (stream.eat("/")) {
          stream.skipToEnd();
          return "comment";
        }
      }

      if (isNegativeChar.test(ch)) {
        if(isNumber(stream.peek(), stream)) return 'number'
        return "operator";
      }

      if (isOperatorChar.test(ch)) {
        stream.eatWhile(isOperatorChar);
        return "operator";
      }
      stream.eatWhile(/[\w\$_\xa1-\uffff]/);
      
      var cur = stream.current();

      console.log(`current token =  ${cur}, last token = ${state.lastToken}`) 

      if (state.grammar == 'doc') {
        if (natSpecTags.some(function (item) { return cur == `@${item}` })) return 'docReserve'
        return 'doc'
      } 
      
      if (cur === 'solidity' && state.lastToken == 'pragma') {
        state.lastToken = state.lastToken + ' ' + cur;
      }
    
      
      if (keywords.propertyIsEnumerable(cur)) {
        if (cur == "case" || cur == "default") curPunc = "case";
        if (keywordsSpecial.propertyIsEnumerable(cur)) state.lastToken = cur;
        //if (cur == 'function' && state.para == 'parameterMode') 
        return "keyword";
      }

      if (keywordsEtherUnit.propertyIsEnumerable(cur)) return "etherUnit";
      if (keywordsContractRelated.propertyIsEnumerable(cur)) return "contractRelated";
      if (keywordsControlStructures.propertyIsEnumerable(cur) ||    keywordsTypeInformation.propertyIsEnumerable(cur) || 
        keywordsV0505NewReserve.propertyIsEnumerable(cur)) return "keyword";
      if (keywordsValueTypes.propertyIsEnumerable(cur) || keywordsTimeUnit.propertyIsEnumerable(cur) || isValidInteger(cur) || isValidBytes(cur) || isValidFixed(cur)) {
        state.lastToken = state.lastToken + 'variable';
        return  'keyword'
      }
      
      if (atoms.propertyIsEnumerable(cur)) return "atom";
      if (keywordsErrorHandling.propertyIsEnumerable(cur)) return 'errorHandling';
      if (keywordsMathematicalAndCryptographicFuctions.propertyIsEnumerable(cur)) return 'mathematicalAndCryptographic';

      if (keywordsMoreBlockAndTransactionProperties.propertyIsEnumerable(cur) || 
        (keywordsBlockAndTransactionProperties[cur] && keywordsBlockAndTransactionProperties[cur].some(function (item) { return stream.match(`.${item}`) }))) return "variable-2";
      
      if (keywordsAbiEncodeDecodeFunctions[cur] && keywordsAbiEncodeDecodeFunctions[cur].some(function (item) { return stream.match(`.${item}`) })) return 'abi';

      var style = updateHexLiterals(cur, stream);
      if (style != null) return style;
      
      if ((state.lastToken == 'functionName(' || state.lastToken == 'returns(') && keywordsContractList.propertyIsEnumerable(cur)) {

        state.lastToken += 'variable'
        return 'variable'
      }
      if (state.lastToken == 'function') {
        state.lastToken = 'functionName';
        if (state.para == null) {
          state.grammar = 'function';
          state.para = '';
        }
        //state.parasMode = isNaN(state.parasMode) ? 1 : state.functionLayerCount++;
        state.para += 'functionName';
        console.log('add para,', state.para);
        return "functionName";
      }
  

      if (state.lastToken == 'functionName(variable') {
        console.log('functionName=>',cur)
        state.lastToken = 'functionName(';
          return 'parameterValue';
      }  

      if (state.lastToken == 'returns(variable') {
        console.log('checking', cur);
        state.lastToken = 'returns(';
        return 'parameterValue';
      }

      if (state.lastToken == 'address' && cur == 'payable') { state.lastToken = 'address payable' }; 
      if (state.lastToken == 'contract' || state.lastToken == 'struct') { console.log('0000'); keywordsContractList[cur] = true; state.lastToken = null; console.log(keywordsContractList) }
      if (state.grammar == 'function') {
        return 'parameterValue'
      }

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
        return !state.startOfLine && (stream.match(/[\^{0}][0-9\.]+/) || stream.match(/[\>\=]+?[\s]*[0-9\.]+[\s]*[\<]?[\s]*[0-9\.]+/) )        
      };
    }

    function isNumber(ch, stream) {
      if (/[\d\.]/.test(ch)) {
        if (ch == ".") {
          stream.match(/^[0-9]+([eE][\-+]?[0-9]+)?/);
        } else if (ch == "0") {
          stream.match(/^[xX][0-9a-fA-F]+/) || stream.match(/^0[0-7]+/);
        } else {
          stream.match(/^[0-9]*\.?[0-9]*([eE][\-+]?[0-9]+)?/);
        }
        return true;
      }
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

    function isValidFixed(token) {
      if (token.match(/^[u]?fixed([0-9]+x[0-9]+)?/)) {
        if (token.indexOf('d') + 1 == token.length) return true;
        var numberPart = token.substr(token.indexOf('d') + 1, token.length).split('x');
        console.log(numberPart[0] + ' , '+numberPart[1])
        return (numberPart[0] % 8 === 0 && numberPart[0] <= 256 && numberPart[1] <= 80)
      }
    }

    function updateHexLiterals(token, stream) {
      if (token.match(/^hex/) && stream.peek()=='\"') {
        var maybeEnd = false, ch, hexValue = '', stringAfterHex='';
        while (ch = stream.next()) {
          stringAfterHex += ch;
          if (ch == '\"' && maybeEnd) {
            hexValue = stringAfterHex.substring(1, stringAfterHex.length-1);
            if (hexValue.match(/^[0-9a-fA-F]+$/)) {
              return 'number'
            } else {
              stream.backUp(stringAfterHex.length); 
            }
            break;
          }
          maybeEnd = maybeEnd || (ch == '\"');
          
        }
       
      }
    }

    function updateGarmmer(ch, state) {
      //console.log('======Begin===, ', state.para, ch);
     
      if (ch == ',' && state.para == 'functionName(variable') {
        state.para = 'functionName(';
        
      }
      if (state.para!=null && state.para.startsWith('functionName')) {
        if (ch == ')') {
          if (state.para.endsWith('(')) {
            state.para = state.para.substr(0, state.para.length - 1)
            if (state.para == 'functionName')
              state.grammar = ''
          }
        } else if (ch == '(') {
          state.para += ch;
        }
      }

      if (ch == '(' && state.lastToken == 'functionName') {
        state.lastToken += ch;
      } else if (ch == ')' && state.lastToken == 'functionName(') {
        state.lastToken = null;
      }else if(ch == '(' && state.lastToken == 'returns') {
        //console.log('=======>returns start');
        state.lastToken += ch;
      }else if(ch == ')' && (state.lastToken == 'returns(' || state.lastToken == 'returns(variable')) {
        //console.log('=======>returns end');
        state.lastToken = null;
      }
      if (ch == '(' && state.lastToken == 'address') {
        //console.log('=======>address start');
        state.lastToken += ch;
      }
      //console.log('======End===, ', state.para);
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
        if (state.grammar == 'doc') state.grammar = null;
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
