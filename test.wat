;; -*- mode: scheme -*-

  ;;;;; Test Core Language

  ;; DEF

  (provide ()
    (def (x y) (list #t #f))
    (assert (eq? x #t))
    (assert (eq? y #f))
    
    (assert (eq? (def #ign #t) #t)))

  ;; IF

  (provide ()
    (assert (eq? #t (if #t #t #f)))
    (assert (eq? #f (if #f #t #f))))

  ;; VAU

  (provide ()
    (def env (current-environment))
    (eq? #t ((vau x #ign x) #t))
    (eq? #t ((vau (x . #ign) #ign x) (list #t)))
    (eq? env ((vau #ign e e))))

  ;; EVAL

  (provide ()
    (def env (current-environment))
    (eval (list def (quote x) #t) env)
    (assert (eq? x #t))
    
    (assert (eq? (eval #t env) #t)))

  ;; WRAP

  (provide ()
    (assert (eq? #t ((wrap (vau (x) #ign x)) (not #f)))))

  ;; UNWRAP

  (provide ()
    (assert (eq? list (unwrap (wrap list)))))

  ;; EQ?

  (provide ()
    (assert (eq? #t #t))
    (assert (not (eq? #t #f)))
    (assert (not (eq? (list 1) (list 1)))))

  ;; CONS

  (provide ()
    (assert (eq? #t (car (cons #t #f))))
    (assert (eq? #f (cdr (cons #t #f)))))

  ;; MAKE-ENVIRONMENT

  (provide ()
    (def e1 (make-environment))
    (eval (list def (quote x) #t) e1)
    (eval (list def (quote y) #t) e1)
    (assert (eq? #t (eval (quote x) e1)))
    (assert (eq? #t (eval (quote y) e1)))

    (def e2 (make-environment e1))
    (assert (eq? #t (eval (quote x) e2)))
    (assert (eq? #t (eval (quote y) e2)))
    (eval (list def (quote y) #f) e2)
    (assert (eq? #f (eval (quote y) e2)))
    (assert (eq? #t (eval (quote y) e1))))

  ;; MAKE-TYPE
 
  (provide ()
    (def (type tagger untagger) (make-type))
    (assert (eq? (type-of type) (type-of (type-of #t))))
    (let ((x (list #void)))
      (eq? type (type-of (tagger x)))
      (eq? x (untagger (tagger x)))))

  ;; TYPE-OF

  (provide ()
    (assert (not (eq? (type-of () #void))))
    (assert (eq? (type-of 0) (type-of 1))))

  ;; VECTOR, VECTOR-REF

  (provide ()
    (def (a b c) (list 1 2 3))
    (def v (vector a b c))
    (assert (eq? (vector-ref v 0) a))
    (assert (eq? (vector-ref v 1) b))
    (assert (eq? (vector-ref v 2) c)))

  ;; Quotation

  (provide ()
    (assert (symbol? 'x))
    (assert (pair? '(a . b))))

  ;;;;; Test Crust Language

  ;; NULL?

  (provide ()
    (assert (null? ()))
    (assert (not (null? 12))))

  ;; BEGIN

  (provide ()
    (assert (eq? #void (begin)))
    (assert (eq? #t (begin (eq? #t #t))))
    (assert (eq? #t (begin #f (eq? #t #t)))))

;; IDENTITY-HASH-CODE

(provide ()
  (assert (not (eq? (identity-hash-code "foo") (identity-hash-code "bar")))))

;; DEFINE-RECORD-TYPE

(provide ()
  (define-record-type pare
    (kons kar kdr)
    pare?
    (kar kar set-kar!)
    (kdr kdr set-kdr!))
  (define p (kons 1 2))
  (assert (num= 1 (kar p)))
  (assert (num= 2 (kdr p)))
  (set-kar! p 3)
  (set-kdr! p 4)
  (assert (num= 3 (kar p)))
  (assert (num= 4 (kdr p)))
  (assert (pare? p))
  (assert (eq? #f (pare? 12))))

;; DEFINED?

(provide ()
  (assert (eq? #f (defined? 'x (current-environment))))
  (assert (eq? #f (defined? 'y (current-environment))))
  (define x 1)
  (assert (eq? #t (defined? 'x (current-environment))))
  (assert (eq? #f (defined? 'y (current-environment))))
)

;; Delimited Control

(define-syntax test-check
  (vau (#ign expr res) env
    (assert (num= (eval expr env) (eval res env)))))

(define new-prompt make-prompt)

(test-check 'test2
  (let ((p (new-prompt)))
    (+ (push-prompt p (push-prompt p 5))
       4))
  9)



(test-check 'test3-1
  (let ((p (new-prompt)))
    (+ (push-prompt p (push-prompt p (+ (take-subcont p #ign 5) 6)))
       4))
  9)

(test-check 'test3-2
  (let ((p (new-prompt)))
    (let ((v (push-prompt p
	       (let* ((v1 (push-prompt p (+ (take-subcont p #ign 5) 6)))
		      (v1 (take-subcont p #ign 7)))
		 (+ v1 10)))))
      (+ v 20)))
  27)

(test-check 'test4
  (let ((p (make-prompt)))
    (+ (push-prompt p
         (+ (take-subcont p sk (push-subcont sk 5))
	    7))
       20))
  32)

(test-check 'test6
  (let ((p1 (new-prompt))
	(p2 (new-prompt))
	(push-twice (lambda (sk)
		      (push-subcont sk (push-subcont sk 3)))))
    (+ 10
      (push-prompt p1 (+ 1
        (push-prompt p2 (take-subcont p1 sk (push-twice sk)))))))
  15)

(test-check 'test7
  (let* ((p1 (new-prompt))
	 (p2 (new-prompt))
	 (p3 (new-prompt))
	 (push-twice
	    (lambda (sk)
	      (push-subcont sk (push-subcont sk
		(take-subcont p2 sk2
		  (push-subcont sk2
		    (push-subcont sk2 3))))))))
    (+ 100
      (push-prompt p1
	(+ 1
	  (push-prompt p2
	    (+ 10
	      (push-prompt p3 (take-subcont p1 sk (push-twice sk)))))))))
  135)

(test-check 'monadic-paper
  (let ((p (make-prompt)))
    (+ 2 (push-prompt p
            (if (take-subcont p k
                  (+ (push-subcont k #f)
		     (push-subcont k #t)))
		3
		4))))
  9)

(test-check 'ddb-1
  (let ((dv (dnew #void)))
    (dlet dv 12 (dref dv)))
  12)

(test-check 'ddb-2
  (let ((dv (dnew #void)))
    (dlet dv 12 (dlet dv 14 (dref dv))))
  14)

(test-check 'ddb-3
  (let ((dv (dnew #void)) (p (make-prompt)))
    (dlet dv 1
      (push-prompt p
        (dlet dv 3
          (take-subcont p k (dref dv))))))
  1)

(test-check 'ddb-4
  (let ((dv (dnew #void)) (p (make-prompt)))
    (dlet dv 1
      (push-prompt p
        (dlet dv 3
          (take-subcont p k
	    (push-subcont k
	       (dref dv)))))))
  3)

