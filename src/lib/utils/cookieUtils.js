
/**
 * 쿠키 관련 유틸리티 함수
 */

/**
 * 쿠키를 설정합니다.
 * @param {string} name 쿠키 이름
 * @param {string} value 쿠키 값
 * @param {number} days 만료일 (일)
 */
export function setCookie(name, value, days) {
    let expires = "";
    if (days) {
        const date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + (value || "")  + expires + "; path=/";
}

/**
 * 쿠키 값을 가져옵니다.
 * @param {string} name 쿠키 이름
 * @returns {string|null} 쿠키 값 또는 null
 */
export function getCookie(name) {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for(let i=0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0)==' ') c = c.substring(1,c.length);
        if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length,c.length);
    }
    return null;
}

/**
 * 쿠키를 삭제합니다.
 * @param {string} name 쿠키 이름
 */
export function eraseCookie(name) {
    document.cookie = name + '=; Max-Age=-99999999; path=/';
}
