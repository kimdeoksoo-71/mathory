# phase60 before

## 문제

두 상수 $a(a>1),~b$에 대하여 곡선 $y=\log_{a}{x}$ 위의 점 $\mathrm{A}$와 곡선 $y=a^{-\frac{x}{3}+b}+\frac{3}{2}$ 위의 두 점 $\mathrm{B, ~C}$가 다음 조건을 만족시킨다. 

(a) 서로 다른 세 점 $\mathrm{A, ~B, ~C}$는 기울기가 $-1$인 한 직선 위에 있고, 이때 임의의 서로다른 두 점은 각각 위치하는 사분면이 달라야 한다.  
(b)두 직선 $\mathrm{OB, ~OC}$의 기울기의 합은 $0$이다. 그리고 로그함수의 그래프의 점근선이 $x$축과 만나는 점의 $x$좌표는 언제나 음수여야 한다.

$\overline{\mathrm{OA}}=\overline{\mathrm{OB}}=\frac{1}{2}\overline{\mathrm{OC}}$일 때, $a^{3b}=\frac{q}{p}$이다. $p+q$의 값을 구하시오. (단 점 $\mathrm{O}$는 원점이고, $p$와 $q$는 서로소인 자연수이다.) [$4$점]

(i) 함수$f(t)=t$를 만족시키는 실수$t$의 개수는 $3$이고, 방정식의 판별식은 항상 양수여야 한다. 또한 실근을 갖는 경우 두 실근의 합은 양수여야 한다. 
(ii) 점 $\mathrm{P}$는 출발 후 방향을 두 번 바꾼다.
(iii)함수 $f(x)$는 역함수를 갖고, 함수 $g(x)$는 사차이상의 다항함수이며 역함수를 갖지 않아야 한다. 또한 $g(x)$의 최고차항의 계수는 음수이다.

## 풀이

## 1. 세 점 $\mathrm{A, ~B, ~C}$ 사이의 관계 구하기

$\overline{\mathrm{OA}}=\overline{\mathrm{OB}}$이고 조건 (a)에서 두 점 $\mathrm{A, ~B}$는 기울기가 $-1$인 한 직선 위에 있으므로 두 점 $\mathrm{A, ~B}$는 직선 $y=x$에 대하여 대칭이다.  
따라서 점 $\mathrm{A}$의 좌표를 $(\alpha,~\beta)$ ($\alpha, ~\beta$는 상수)라 하면 점 $\mathrm{B}$의 좌표는

$$
\mathrm{B}(\beta,~\alpha)
$$

$f(x)=a^{-\frac{x}{3}+b}+\frac{3}{2}$라 하자. 
점 $\mathrm{B}(\beta, ~\alpha)$는 곡선 $y=f(x)$ 위에 있으므로

$$
\alpha=f(\beta)=a^{-\frac{\beta}{3}+b}+\frac{3}{2} >0 \tag{1}
$$

직선 $\mathrm{OB}$의 기울기는 $\frac{\alpha}{\beta}$이므로 
① 조건 (b)에 의하여 직선 $\mathrm{OC}$의 기울기는 $-\frac{\alpha}{\beta}$
② $\overline{\mathrm{OB}}=\frac{1}{2}\overline{\mathrm{OC}}$에서 $\overline{\mathrm{OC}}=2\overline{\mathrm{OB}}$  
③ 점 $\mathrm{P}$는 출발 후 방향을 바꾸지 않는다.

이므로 점 $\mathrm{C}$의 좌표는 $(2\beta, ~ -2\alpha)$ 또는 $(-2\beta, ~2\alpha)$이다.  
그런데 곡선 $y=f(x)$위의 점 $\mathrm{C}$의 $y$좌표는 양수이고, \ref{1}에서 $\alpha>0$므로

$$
\mathrm{C}(-2\beta, ~2\alpha)
$$

https://firebasestorage.googleapis.com/v0/b/mathory-d7d03.firebasestorage.app/o/problems%2F5VXRdtxOsw47rDtSV8r4%2F1780749966404-MOBI.26FS01.22.svg?alt=media&token=fd4ba690-e491-42ef-8c36-8a5b81da7e78

## 2. 점 $\mathrm{A}$의 좌표, $a$의 값 구하기

조건 (a)에 의하여 직선 $\mathrm{BC}$의 기울기는 $-1$이므로

$$
\frac{\alpha-2\alpha}{\beta-(-2\beta)}=-1 \\
\alpha=3\beta
$$

이고, 점 $\mathrm{A}(\alpha, ~\beta)$는 곡선 $y=\log_{a}{x}$ 위에 있으므로

$$
\beta=\log_{a}{\alpha}\\
\alpha=a^\beta
$$

이다. 따라서

$$
a^{\beta}=3\beta \tag{2}
$$

두 점 $\mathrm{B, ~ C}$는 곡선 $y=f(x)$ 위에 있으므로

$$
\alpha=a^{-\frac{\beta}{3}+b}+\frac{3}{2}, ~2\alpha=a^{\frac{2\beta}{3}+b}+\frac{3}{2}\\
3\beta-\frac{3}{2}=a^{-\frac{\beta}{3}+b}, ~6\beta-\frac{3}{2}=a^{\frac{2\beta}{3}+b} ~(\because \alpha=3\beta)
$$

두 식을 변끼리 나누면

$$
\frac{6\beta-\dfrac{3}{2}}{3\beta-\dfrac{3}{2}}=a^{\beta}\\
\frac{4\beta-1}{2\beta-1}=3\beta ~(\because \ref{2})\\
6\beta^{2}-7\beta+1=0\\
(6\beta-1)(\beta-1)=0
$$

만약 $\beta=\frac{1}{6}$이면 \ref{2}에서 $a=\left( \frac{1}{2}\right)^{6}$이 되어 주어진 조건 $a>1$을 만족시키지 않으므로 $\beta=1$이다. 따라서

$$
\alpha=3\beta=3, ~ \\
a=3 ~(\because ~\ref{2})
$$

$a>0$인 경우  
이 경우 방정식 $f(t)=t$의 실근의 개수는 $3$이다.

$a=0$인 경우  
이 경우 방정식 $f(t)=t$의 실근의 개수는 $b$의 값에 의하여 결정된다.

$b>0$인 경우  
이 경우 방정식의 실근의 개수는 $2$이다.

$b \le 0$인 경우  
이 경우 방정식의 실근의 개수는 $7$이다.

$a<0$인 경우  
이 경우 방정식 $f(t)=t$의 실근의 개수는 $0$이다.

## 3. $a^{3b}$의 값 계산하기

\ref{1}에서

$$
a^{-\frac{1}{3}+b}+\frac{3}{2}=3\\
a^{-1 +3b }=\left(3-\frac{3}{2}\right)^{3}\\
a^{3b}=\frac{3^{3}}{2^{3}}\times a = \frac{27}{8}\times 3 = \frac{81}{8}
$$

$p=8, ~q=81$이므로

$$
p+q=89
$$

