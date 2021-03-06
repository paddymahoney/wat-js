function Wat() {
    /***** Evaluation *****/
    /* Fibers */
    function run(x) { return evaluate(envcore, null, null, x); }
    function Suspension(prompt, handler) { this.prompt = prompt; this.handler = handler; this.resumption = null; }
    function isSuspend(x) { return x instanceof Suspension; }
    function Resumption(fun, next, dbginfo) {
        this.fun = fun; this.next = next; this.dbginfo = dbginfo ? dbginfo : VOID;
    }
    function isResume(x) { return x instanceof Resumption; }
    function pushResume(susp, fun, dbginfo) {
        susp.resumption = new Resumption(fun, susp.resumption, dbginfo);
    }
    function resume(resumption, f) { return resumption.fun(resumption.next, f); }
    function evaluate(e, k, f, x) {
        if (x && x.wat_eval) return x.wat_eval(e, k, f); else return x;
    }
    Sym.prototype.wat_eval = function(e, k, f) { return lookup(e, this); };
    Cons.prototype.wat_eval = function(e, k, f) {
        if (isResume(k)) {
            var op = resume(k, f);
        } else {
            var op = evaluate(e, null, null, car(this));
        }
        if (isSuspend(op)) {
            var that = this;
            pushResume(op, function(k, f) { return that.wat_eval(e, k, f); }, that);
            return op;
        }
        if (isMacro(op)) {
            return macroCombine(e, null, null, op, this);
        } else {
            return combine(e, null, null, op, cdr(this));
        }
    };
    function macroCombine(e, k, f, macro, form) {
        var cached_macro = form.cached_macro;
        var cache = form.cache;
        if (cached_macro !== macro) {
            cache = macroExpand(e, k, f, macro, form);
            form.cache = cache;
            form.cached_macro = macro;
        }
        return evaluate(e, k, f, cache);
    }
    function macroExpand(e, k, f, macro, form) {
        return combine(e, k, f, macro.expander, cdr(form));
    }
    function Macro(expander) { this.expander = expander; }
    function isMacro(x) { return x instanceof Macro; }
    function Def() {}
    Def.prototype.combine = function(e, k, f, o) {
        if (isResume(k)) {
            var val = resume(k, f);
        } else {
            var val = evaluate(e, null, null, elt(o, 1));
        }
        if (isSuspend(val)) {
            pushResume(val, function(k, f) { return Def.prototype.combine(e, k, f, o); }, cons(this,o));
            return val;
        }
        return bind(e, elt(o, 0), val);
    };
    /* Operative & Applicative Combiners */
    function combine(e, k, f, cmb, o) {
        return cmb.combine ? cmb.combine(e, k, f, o) : fail("not a combiner");
    }
    function Opv(p, ep, x, e) { this.p = p; this.ep = ep; this.x = x; this.e = e; }
    function Apv(cmb) { this.cmb = cmb; }; function wrap(cmb) { return new Apv(cmb); }; function unwrap(apv) { return apv.cmb; }
    Opv.prototype.combine = function(e, k, f, o) {
	var xe = new Env(this.e); bind(xe, this.p, o); bind(xe, this.ep, e);
        return evaluate(xe, k, f, this.x);
    };
    Apv.prototype.combine = function(e, k, f, o) {
        if (isResume(k)) {
            var args = resume(k, f);
        } else {
            var args = evalArgs(e, null, null, o, NIL);
        }
        if (isSuspend(args)) {
            var that = this;
            pushResume(args, function(k, f) { return that.combine(e, k, f, o); }, cons(this, o));
            return args;
        }
        return this.cmb.combine(e, null, null, args);
    };
    function evalArgs(e, k, f, todo, done) {
	if (todo === NIL) { return reverse_list(done); }
        if (isResume(k)) {
            var arg = resume(k, f);
        } else {
            var arg = evaluate(e, null, null, car(todo));
        }
        if (isSuspend(arg)) {
            pushResume(arg, function(k, f) { return evalArgs(e, k, f, todo, done); });
            return arg;
        }
        return evalArgs(e, null, null, cdr(todo), cons(arg, done));
    };
    /* Built-in Combiners */
    function Vau() {}; function If() {}; function Eval() {}; function Begin() {}; function Loop() {};
    function Catch() {}; function Throw() {}; function Finally() {};
    Vau.prototype.combine = function(e, k, f, o) { return new Opv(elt(o, 0), elt(o, 1), elt(o, 2), e); };
    If.prototype.combine = function(e, k, f, o) {
        if (isResume(k)) {
            var test = resume(k, f);
        } else {
            var test = evaluate(e, null, null, elt(o, 0));
        }
        if (isSuspend(test)) {
            pushResume(test, function(k, f) { return If.prototype.combine(e, k, f, o); }, cons(this,o));
            return test;
        }
        return evaluate(e, null, null, (test === F) ? elt(o, 2) : elt(o, 1));
    };
    Eval.prototype.combine = function(e, k, f, o) { return evaluate(elt(o, 1), k, f, elt(o, 0)); };
    Begin.prototype.combine = function(e, k, f, o) { if (o === NIL) return VOID; else return begin(e, k, f, o); };
    function begin(e, k, f, xs) {
        if (isResume(k)) {
            var res = resume(k, f);
        } else {
            var res = evaluate(e, null, null, car(xs));
        }
        if (isSuspend(res)) {
            pushResume(res, function(k, f) { return begin(e, k, f, xs); });
            return res;
        }
        var kdr = cdr(xs);
        if (kdr === NIL) return res; else return begin(e, null, null, kdr);
    }
    Loop.prototype.combine = function(e, k, f, o) {
        var first = true; // only resume once
        while (true) {
            if (first && isResume(k)) {
                var res = resume(k, f);
            } else {
                var res = evaluate(e, null, null, elt(o, 0));
            }
            first = false;
            if (isSuspend(res)) {
                pushResume(res, function(k, f) { return Loop.prototype.combine(e, k, f, o); }, cons(this,o));
                return res;
            }
        }
    }
    Catch.prototype.combine = function(e, k, f, o) {
        var tag = elt(o, 0);
        var th = elt(o, 1);
        try {
            if (isResume(k)) {
                var res = resume(k, f);
            } else {
                var res = combine(e, null, null, th, NIL);
            }
        } catch(exc) {
            if (exc.wat_tag && exc.wat_tag === tag) {
                return exc.wat_val;
            } else {
                throw exc;
            }
        }
        if (isSuspend(res)) {
            pushResume(res, function(k, f) { return Catch.prototype.combine(e, k, f, o); }, cons(this,o));
            return res;
        } else {
            return res;
        }
    };
    function Exc(tag, val) { this.wat_tag = tag; this.wat_val = val; }
    Throw.prototype.combine = function(e, k, f, o) {
        var tag = elt(o, 0);
        var val = elt(o, 1);
        throw new Exc(tag, val);
    };
    Finally.prototype.combine = function(e, k, f, o) {
        var prot = elt(o, 0);
        var cleanup = elt(o, 1);
        try {
            if (isResume(k)) {
                var res = resume(k, f);
            } else {
                var res = evaluate(e, null, null, prot);
            }
            if (isSuspend(res)) {
                pushResume(res, function(k, f) { return Finally.prototype.combine(e, k, f, o); }, cons(this,o));
            }
        } finally {
            if (isSuspend(res)) {
                return res;
            } else {
                return doFinally(e, null, null, cleanup, res);
            }
        }
    };
    function doFinally(e, k, f, cleanup, res) {
        if (isResume(k)) {
            var fres = resume(k, f);
        } else {
            var fres = evaluate(e, null, null, cleanup);
        }
        if (isSuspend(fres)) {
            pushResume(fres, function(k, f) { return doFinally(e, k, f, cleanup, res); });
            return fres;
        } else {
            return res;
        }
    }
    /* Dynamic Variables */
    function DV(val) { this.val = val; }
    function DNew() {}; function DLet() {}; function DRef() {};
    DNew.prototype.combine = function(e, k, f, o) {
        return new DV(elt(o, 0));
    }
    DLet.prototype.combine = function(e, k, f, o) {
        var dv = elt(o, 0);
        var val = elt(o, 1);
        var th = elt(o, 2);
        var oldVal = dv.val;
        dv.val = val;
        try {
            if (isResume(k)) {
                var res = resume(k, f);
            } else {
                var res = combine(e, null, null, th, NIL);
            }
            if (isSuspend(res)) {
                pushResume(res, function(k, f) { return DLet.prototype.combine(e, k, f, o); }, cons(this,o));
                return res;
            } else {
                return res;
            }
        } finally {
            dv.val = oldVal;
        }
    }
    DRef.prototype.combine = function(e, k, f, o) {
        return elt(o, 0).val;
    };
    /* Delimited Control */
    function PushPrompt() {}; function TakeSubcont() {}; function PushSubcont() {};
    PushPrompt.prototype.combine = function(e, k, f, o) {
        var prompt = elt(o, 0);
        var th = elt(o, 1);
        if (isResume(k)) {
            var res = resume(k, f);
        } else {
            var res = combine(e, null, null, th, NIL);
        }
        if (isSuspend(res)) {
            if (res.prompt === prompt) {
                var resumption = res.resumption;
                var handler = res.handler;
                return combine(e, null, null, handler, cons(resumption, NIL));
            } else {
                pushResume(res, function(k, f) { return PushPrompt.prototype.combine(e, k, f, o); }, cons(this,o));
                return res;
            }
        } else {
            return res;
        }
    };
    TakeSubcont.prototype.combine = function(e, k, f, o) {
        var prompt = elt(o, 0);
        var handler = elt(o, 1);
        var susp = new Suspension(prompt, handler);
        pushResume(susp, function(k, f) { return combine(e, null, null, f, NIL); }, cons(this, o));
        return susp;
    };
    PushSubcont.prototype.combine = function(e, k, f, o) {
        var thek = elt(o, 0);
        var thef = elt(o, 1);
        if (isResume(k)) {
            var res = resume(k, f);
        } else {
            var res = resume(thek, thef);
        }
        if (isSuspend(res)) {
            pushResume(res, function(k, f) { return PushSubcont.prototype.combine(e, k, f, o); }, cons(this,o));
            return res;
        } else {
            return res;
        }
    };
    /* JS Bridge */
    function JSFun(jsfun) { this.jsfun = jsfun; }
    JSFun.prototype.combine = function(e, k, f, o) { return this.jsfun.apply(null, list_to_array(o)); };
    function jswrap(jsfun) { return wrap(new JSFun(jsfun)); }
    function JSOBJ() {};
    function js_global(name) { return js_prop(WAT_GLOBAL, name); }
    function js_set_global(name, val) { return js_set_prop(WAT_GLOBAL, name, val); }
    function js_prop(obj, name) { assert(type_of(name) === Str.prototype.wat_type); return obj[name.jsstr]; }
    function js_set_prop(obj, name, val) { assert(type_of(name) === Str.prototype.wat_type); return obj[name.jsstr] = val; }
    function js_function(jsfun) { return jswrap(jsfun); }
    function js_method(name) { return jswrap(function(obj) {
	var args = Array.prototype.slice.call(arguments, 1); return obj[name.jsstr].apply(obj, args); }); }
    function to_js(obj) { return (obj && obj.to_js) ? obj.to_js() : obj; }
    Str.prototype.to_js = function() { return this.jsstr; }
    Num.prototype.to_js = function() { return jsnums.toFixnum(this.jsnum); }
    Bool.prototype.to_js = function() { return this === T ? true : false; }
    function from_js(obj) {
	switch(typeof(obj)) {
	case "string": return new Str(obj);
	case "number": return new Num(jsnums.fromFixnum(obj));
	case "boolean": return obj === true ? T : F;
	default: return obj;
	}
    }
    function JSCallback() {};
    JSCallback.prototype.combine = function(e, k, f, o) {
        var cmb = elt(o, 0);
        return function() {
            var args = array_to_list(Array.prototype.slice.call(arguments));
            combine(e, null, null, cmb, args);
        };
    }
    /***** Objects *****/
    /* Core */
    function Sym(name) { this.name = name; }
    function Cons(car, cdr) { this.car = car; this.cdr = cdr; }
    function cons(car, cdr) { return new Cons(car, cdr); }
    function car(cons) { assert(type_of(cons) === Cons.prototype.wat_type); return cons.car; }
    function cdr(cons) { assert(type_of(cons) === Cons.prototype.wat_type); return cons.cdr; }
    function elt(cons, i) { return (i === 0) ? car(cons) : elt(cdr(cons), i - 1); }
    function Env(parent) { this.bindings = Object.create(parent ? parent.bindings : null); }
    function lookup0(e, sym) { return e.bindings[sym.name]; }
    function lookup(e, sym) { var val = lookup0(e, sym); return (val !== undefined) ? val : fail("unbound: " + sym.name); }
    function bind(e, lhs, rhs) { lhs.match(e, rhs); return rhs; }
    Sym.prototype.match = function(e, rhs) { if (rhs === undefined) fail("trying to match against undefined: " + this.name); 
                                             e.bindings[this.name] = rhs; };
    Cons.prototype.match = function(e, rhs) { car(this).match(e, car(rhs)); cdr(this).match(e, cdr(rhs)); };
    Nil.prototype.match = function(e, rhs) { if (rhs !== NIL) fail("NIL expected"); };
    Ign.prototype.match = function(e, rhs) {};
    function bound(sym, e) { return (e.bindings[sym.name] !== undefined); }
    var IDHASH = 0; var IDHASH_MAX = Math.pow(2, 53);
    function idhash(obj) { 
        if (obj.wat_idhash === undefined) {
            if (IDHASH >= IDHASH_MAX) IDHASH = 0;
            obj.wat_idhash = IDHASH;
            IDHASH++; }
        return obj.wat_idhash; }
    /* Data */
    function Str(jsstr) { this.jsstr = jsstr; };
    function str_eql(str1, str2) { return str1.jsstr === str2.jsstr; }
    function str_cat(strings) { return strings.map(function(str) { return str.jsstr; }).join(""); }
    function str_print(str1) { return JSON.stringify(str1.jsstr); }
    function Num(jsnum) { this.jsnum = jsnum; };
    function num_eql(num1, num2) { return jsnums.equals(num1.jsnum, num2.jsnum); }
    function num_lt(num1, num2) { return jsnums.lessThan(num1.jsnum, num2.jsnum); }
    function num_add(num1, num2) { return new Num(jsnums.add(num1.jsnum, num2.jsnum)); };
    function num_sub(num1, num2) { return new Num(jsnums.subtract(num1.jsnum, num2.jsnum)); };
    function num_mul(num1, num2) { return new Num(jsnums.multiply(num1.jsnum, num2.jsnum)); };
    function num_div(num1, num2) { return new Num(jsnums.divide(num1.jsnum, num2.jsnum)); };
    function num_mod(num1, num2) { return new Num(jsnums.modulo(num1.jsnum, num2.jsnum)); };
    function Vector(elements) { this.elements = elements; }
    function vector_ref(vector, i) { return vector.elements[i]; }
    function vector_set(vector, i, val) { vector.elements[i] = val; return val; }
    function vector_length(vector) { return vector.length; }
    function Void() {}; function Ign() {}; function Nil() {}; function Bool() {}
    var VOID = new Void(); var IGN = new Ign(); var NIL = new Nil(); var T = new Bool(); var F = new Bool()
    function str_to_sym(str) { return new Sym(str.jsstr); }
    function sym_to_str(sym) { return new Str(sym.name); }
    function str_to_num(str) { return new Num(jsnums.fromString(str.jsstr)); }
    function num_to_str(num) { return new Str(num.jsnum.toString()); }
    function IdentityHashtable() { this.entries = Object.create(null); }
    function identity_hashtable_put(tbl, k, v) {
        var hash = String(idhash(k));
        var bucket = tbl.entries[hash];
        if (bucket === undefined) {
            bucket = [];
            tbl.entries[hash] = bucket;
        }
        for (var i = 0; i < bucket.length; i++) {
            if (bucket[i][0] === k) {
                bucket[i][1] = v;
                return v;
            }
        }
        bucket.push([k, v]);
        return v;
    }
    function identity_hashtable_get(tbl, k, def) {
        var hash = String(idhash(k));
        var bucket = tbl.entries[hash];
        if (bucket === undefined) {
            return def;
        }
        for (var i = 0; i < bucket.length; i++) {
            if (bucket[i][0] === k)
                return bucket[i][1];
        }
        return def;
    }
    function StringHashtable() { this.entries = Object.create(null); }
    function string_hashtable_put(tbl, k, v) {
        assert(k.jsstr !== undefined);
        tbl.entries[k.jsstr] = v;
        return v;
    }
    function string_hashtable_get(tbl, k, def) {
        assert(k.jsstr !== undefined);
        var v = tbl.entries[k.jsstr];
        return (v !== undefined) ? v : def;
    }
    /* Types */
    function Type() {};
    function Tagged(type, val) { this.wat_type = type; this.val = val };
    function type_of(obj) { if (obj && obj.wat_type) return obj.wat_type; else return JSOBJ.prototype.wat_type; }
    function make_type() {
	var type = new Type();
	var tagger = jswrap(function(val) { return new Tagged(type, val); });
	var untagger = jswrap(function(obj) { if (type_of(obj) === type) return obj.val; else fail("wrong type"); });
	return cons(type, cons(tagger, cons(untagger, NIL))); }
    function label(obj) { 
        if (obj.wat_type) return obj.wat_label ? obj.wat_label : "anonymous";
        else return "JS " + obj.toString();
    }
    function set_label(type, name) { type.wat_label = name; }
    function put_method(type, name, method) { type[name.jsstr] = method; return method; }
    function find_method(type, name, deflt) {
        var method = type[name.jsstr];
        if (method !== undefined) return method; else return deflt;
    }
    function init_types(typenames) {
        typenames.map(function (typename) { var type = new Type(); set_label(type, typename);
                                            eval(typename).prototype.wat_type = type; }); }
    init_types([
        "Apv",
        "Bool",
        "Catch",
        "Cons",
        "DLet",
        "DNew",
        "DRef",
        "Def",
        "Env",
        "Eval",
        "IdentityHashtable",
        "If",
        "Ign",
        "JSFun",
        "JSOBJ",
        "Loop",
        "Macro",
        "Nil",
        "Num",
        "Opv",
        "Resumption",
        "Str",
        "Suspension",
        "Sym",
        "Throw",
        "Type",
        "Vau",
        "Vector",
        "Void",
    ]);
    /* Utilities */
    function assert(b) { if (!b) fail("assertion failed"); }
    function fail(err) { throw err; }
    function log(str) { console.log(str); return str; }
    function currentMilliseconds() { return new Num(new Date().getTime()); }
    function array_to_list(array, end) {
	var c = end ? end : NIL; for (var i = array.length; i > 0; i--) c = cons(array[i - 1], c); return c; }
    function list_to_array(c) {
	var res = []; while(c !== NIL) { res.push(car(c)); c = cdr(c); } return res; }
    function reverse_list(list) {
	var res = NIL; while(list !== NIL) { res = cons(car(list), res); list = cdr(list); } return res; }
    function list_star() {
        var len = arguments.length;
	var c = len >= 1 ? arguments[len-1] : NIL; for (var i = len-1; i > 0; i--) c = cons(arguments[i - 1], c); return c; }
    /***** Parser *****/
    function parse(s) { // Returns array of forms
	var res = program_stx(ps(s));
	if (res.remaining.index === s.length) return res.ast; else fail("parse error at " + res.remaining.index + " in " + s); }
    var x_stx = function(input) { return x_stx(input); }; // forward decl.
    var id_special_char = choice("-", "&", "!", ":", "=", ">", "<", "%", "+", "?", "/", "*", "#", "$", "_", "'", ".");
    var id_char = choice(range("a", "z"), range("A", "Z"), range("0", "9"), id_special_char);
    // Kludge: don't allow single dot as id, so as not to conflict with dotted pair stx.
    var id_stx = action(join_action(butnot(repeat1(id_char), "."), ""), function (ast) { return new Sym(ast); });
    var escape_char = choice("\"", "\\");
    var escape_sequence = action(sequence("\\", escape_char), function (ast) { return ast[1]; });
    var string_char = choice(negate(escape_char), escape_sequence);
    var string_stx =
	action(sequence("\"", join_action(repeat0(string_char), ""), "\""), function (ast) { return new Str(ast[1]); });
    var digits = join_action(repeat1(range("0", "9")), "");
    var number_stx = action(sequence(optional(choice("+", "-")), digits, optional(join_action(sequence(".", digits), ""))),
			    function (ast) {
				var sign = ast[0] ? ast[0] : "";
				var integral_digits = ast[1]; 
				var fractional_digits = ast[2] || "";
				return new Num(jsnums.fromString(sign + integral_digits + fractional_digits)); });
    function make_constant_stx(string, constant) { return action(string, function(ast) { return constant; }); }
    var void_stx = make_constant_stx("#void", VOID);
    var ign_stx = make_constant_stx("#ign", IGN);
    var nil_stx = make_constant_stx("()", NIL);
    var t_stx = make_constant_stx("#t", T);
    var f_stx = make_constant_stx("#f", F);
    var dot_stx = action(wsequence(".", x_stx), function (ast) { return ast[1]; });
    var compound_stx = action(wsequence("(", repeat1(x_stx), optional(dot_stx), ")"),
			      function(ast) {
				  var exprs = ast[1];
				  var end = ast[2] ? ast[2] : NIL;
				  return array_to_list(exprs, end); });
    var quote_stx = action(sequence("'", x_stx), function(ast) { return array_to_list([new Sym("quote"), ast[1]]); });
    var line_terminator = choice(ch("\r"), ch("\n"));
    var cmt_stx = action(sequence(";", repeat0(negate(line_terminator)), optional(line_terminator)), nothing_action);
    var whitespace_stx = action(choice(" ", "\n", "\r", "\t"), nothing_action);
    function nothing_action(ast) { return VOID; } // HACK!
    var x_stx = whitespace(choice(void_stx, ign_stx, nil_stx, t_stx, f_stx, number_stx,
				  quote_stx, compound_stx, id_stx, string_stx, cmt_stx));
    var program_stx = whitespace(repeat0(choice(x_stx, whitespace_stx))); // HACK!
    /***** Core Environment *****/
    function envbind(e, name, val) {
        bind(e, new Sym(name), val);
        if (val)
            set_label(val, name);
    }
    function mkenvcore() {
	var e = new Env();
	envbind(e, "def", new Def());
	envbind(e, "if", new If());
	envbind(e, "vau", new Vau());
	envbind(e, "eval", wrap(new Eval()));
	envbind(e, "begin", new Begin());
        envbind(e, "loop1", new Loop());
        envbind(e, "catch*", wrap(new Catch()));
        envbind(e, "throw*", wrap(new Throw()));
	envbind(e, "wrap", jswrap(wrap));
	envbind(e, "unwrap", jswrap(unwrap));
	envbind(e, "eq?", jswrap(function (a, b) { return (a === b) ? T : F }));
	envbind(e, "cons", jswrap(cons));
	envbind(e, "list*", jswrap(list_star));
	envbind(e, "make-environment", jswrap(function (parent) { return new Env(parent); }));
        envbind(e, "defined?", jswrap(function (sym, e) { return (bound(sym, e)) ? T : F }));
	envbind(e, "make-type", jswrap(make_type));
	envbind(e, "type-of", jswrap(type_of));
	envbind(e, "label", jswrap(function(type) { return new Str(label(type)); }));
	envbind(e, "set-label!", jswrap(function(type, name) { set_label(type, name.jsstr); return name; }));
	envbind(e, "identity-hash-code", jswrap(function(obj) { return new Num(jsnums.fromFixnum(idhash(obj))); }));
	envbind(e, "display", jswrap(log));
	envbind(e, "log", jswrap(log));
	envbind(e, "read-from-string", jswrap(function(str) { return array_to_list(parse(str.jsstr)); }));
	envbind(e, "fail", jswrap(fail));
	envbind(e, "num=", jswrap(function(num1, num2) { return num_eql(num1, num2) ? T : F }));
	envbind(e, "num<", jswrap(function(num1, num2) { return num_lt(num1, num2) ? T : F }));
	envbind(e, "+", jswrap(num_add));
	envbind(e, "-", jswrap(num_sub));
	envbind(e, "*", jswrap(num_mul));
	envbind(e, "/", jswrap(num_div));
	envbind(e, "%", jswrap(num_mod));
        envbind(e, "str=", jswrap(function(str1, str2) { return str_eql(str1, str2) ? T : F }));
        envbind(e, "strcat", jswrap(function() {
            return new Str(str_cat.call(null, Array.prototype.slice.call(arguments))); }));
        envbind(e, "str-print", jswrap(function(str) { return new Str(str_print(str)); }));
	envbind(e, "string->symbol", jswrap(str_to_sym));
	envbind(e, "symbol->string", jswrap(sym_to_str));
	envbind(e, "string->number", jswrap(str_to_num));
	envbind(e, "number->string", jswrap(num_to_str));
	envbind(e, "vector", jswrap(function() { return new Vector(Array.prototype.slice.call(arguments)); }));
	envbind(e, "vector-ref", jswrap(function(vector, i) { return vector_ref(vector, jsnums.toFixnum(i.jsnum)); }));
	envbind(e, "vector-set!", jswrap(function(vector, i, val) {
            return vector_set(vector, jsnums.toFixnum(i.jsnum), val); }));
	envbind(e, "vector-length", jswrap(function(vector) { return new Num(jsnums.fromFixnum(vector_length(vector))); }));
        envbind(e, "make-identity-hashtable", jswrap(function() { return new IdentityHashtable(); }));
        envbind(e, "identity-hashtable-put!", jswrap(identity_hashtable_put));
        envbind(e, "identity-hashtable-get", jswrap(identity_hashtable_get));
        envbind(e, "make-string-hashtable", jswrap(function() { return new StringHashtable(); }));
        envbind(e, "string-hashtable-put!", jswrap(string_hashtable_put));
        envbind(e, "string-hashtable-get", jswrap(string_hashtable_get));
	envbind(e, "js-global", jswrap(js_global));
	envbind(e, "js-set-global!", jswrap(js_set_global));
	envbind(e, "js-prop", jswrap(js_prop));
	envbind(e, "js-set-prop!", jswrap(js_set_prop));
	envbind(e, "js-function", jswrap(js_function));
	envbind(e, "js-method", jswrap(js_method));
	envbind(e, "to-js", jswrap(to_js));
	envbind(e, "from-js", jswrap(from_js));
	envbind(e, "js-callback", wrap(new JSCallback()));
	envbind(e, "js-array-to-list", jswrap(array_to_list));
        envbind(e, "js-null", null);
        envbind(e, "finally", new Finally());
        envbind(e, "dnew", wrap(new DNew()));
        envbind(e, "dlet*", wrap(new DLet()));
        envbind(e, "dref", wrap(new DRef()));
        envbind(e, "push-prompt*", wrap(new PushPrompt()));
        envbind(e, "take-subcont*", wrap(new TakeSubcont()));
        envbind(e, "push-subcont*", wrap(new PushSubcont()));
        envbind(e, "put-method!", jswrap(put_method));
        envbind(e, "find-method", jswrap(find_method));
        envbind(e, "macro", jswrap(function(exp) { return new Macro(exp); }));
        envbind(e, "current-milliseconds", jswrap(currentMilliseconds));
	return e;
    }
    var envcore = mkenvcore();
    /***** API *****/
    return { "eval": run, "parse": parse, "Sym": Sym, "array_to_list": array_to_list };
}
var WAT_GLOBAL = this;
// Abbreviations:
// apv: applicative combiner
// arg: argument
// cmb: combiner
// cmt: comment
// e: environment
// ep: environment parameter
// id: identifier
// num: number
// o: operand
// opv: operative combiner
// p: parameter
// str: string
// stx: syntax
// sym: symbol
// x: expression
// xe: extended environment
// xs: expressions
