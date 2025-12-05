const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const MarkdownIt = require('markdown-it');
const { parseDocument } = require('htmlparser2');

class PDFGenerator {
    constructor() {
        this.md = new MarkdownIt({
            html: true,
            linkify: true,
            typographer: true
        });
        this.reportsDir = path.join(__dirname, '../reports');
        this.fontsDir = path.join(__dirname, '../fonts');
        
        // 보고서 디렉토리 생성
        if (!fs.existsSync(this.reportsDir)) {
            fs.mkdirSync(this.reportsDir, { recursive: true });
        }
        
        // 한글 폰트 경로 설정 (.ttf 또는 .otf 지원)
        // 폰트 파일이 실제로 유효한지 확인하는 함수
        const isValidFontFile = (fontPath) => {
            if (!fs.existsSync(fontPath)) return false;
            try {
                const fontBuffer = fs.readFileSync(fontPath);
                // 최소 크기 확인 (1KB 이상)
                if (fontBuffer.length < 1024) return false;
                // 폰트 파일 시그니처 확인
                const signature = fontBuffer.slice(0, 4);
                // OTF: "OTTO" 또는 "ttcf"
                const isOTF = signature[0] === 0x4F && signature[1] === 0x54 && signature[2] === 0x54 && signature[3] === 0x4F;
                // TTF: 첫 4바이트가 특정 값
                const isTTF = (signature[0] === 0x00 && signature[1] === 0x01 && signature[2] === 0x00 && signature[3] === 0x00) ||
                             (signature[0] === 0x4C && signature[1] === 0x50);
                // HTML 문서가 아닌지 확인 (HTML은 보통 "<!DOCTYPE" 또는 "<html"로 시작)
                const isHTML = fontBuffer.toString('utf8', 0, Math.min(100, fontBuffer.length)).trim().toLowerCase().startsWith('<!');
                return (isOTF || isTTF) && !isHTML;
            } catch (error) {
                return false;
            }
        };
        
        const fontPaths = [
            path.join(this.fontsDir, 'NotoSansKR-Regular.ttf'),
            path.join(this.fontsDir, 'NotoSansKR-Regular.otf')
        ];
        this.koreanFontPath = fontPaths.find(p => isValidFontFile(p));
        
        const boldFontPaths = [
            path.join(this.fontsDir, 'NotoSansKR-Bold.ttf'),
            path.join(this.fontsDir, 'NotoSansKR-Bold.otf')
        ];
        this.koreanFontBoldPath = boldFontPaths.find(p => isValidFontFile(p));
    }

    /**
     * 마크다운을 PDF로 변환
     * @param {string} markdown - 마크다운 텍스트
     * @param {string} filename - 파일명 (확장자 제외)
     * @returns {Promise<Object>} PDF 파일 정보
     */
    async convertToPDF(markdown, filename = null) {
        try {
            console.log('📄 PDF 변환 시작...');
            
            // 파일명 생성
            const timestamp = Date.now();
            const pdfFileName = filename 
                ? `${filename}-${timestamp}.pdf`
                : `hot-topic-report-${timestamp}.pdf`;
            const pdfFilePath = path.join(this.reportsDir, pdfFileName);

            // 마크다운을 HTML로 변환
            const htmlContent = this.convertToHTML(markdown);
            
            // PDF 문서 생성
            const doc = new PDFDocument({
                size: 'A4',
                margins: {
                    top: 72,      // 20mm ≈ 72pt
                    bottom: 72,
                    left: 54,     // 15mm ≈ 54pt
                    right: 54
            }
            });

            // 한글 폰트 등록 (폰트 파일이 있으면 사용, 없으면 기본 폰트)
            let koreanFont = 'Helvetica';
            let koreanFontBold = 'Helvetica-Bold';
            
            if (this.koreanFontPath) {
                try {
                    doc.registerFont('Korean', this.koreanFontPath);
                    koreanFont = 'Korean';
                    console.log(`✅ 한글 폰트 등록 완료: ${this.koreanFontPath}`);
                } catch (error) {
                    console.error('한글 폰트 등록 실패:', error.message);
                    console.warn('⚠️ 한글 폰트 없이 기본 폰트로 진행합니다.');
                }
            } else {
                console.warn('⚠️ 한글 폰트 파일을 찾을 수 없습니다. 기본 폰트를 사용합니다.');
            }
            
            if (this.koreanFontBoldPath) {
                try {
                    doc.registerFont('KoreanBold', this.koreanFontBoldPath);
                    koreanFontBold = 'KoreanBold';
                    console.log(`✅ 한글 볼드 폰트 등록 완료: ${this.koreanFontBoldPath}`);
                } catch (error) {
                    console.error('한글 볼드 폰트 등록 실패:', error.message);
                    // Bold 폰트가 없으면 Regular 폰트를 Bold로도 사용
                    if (koreanFont !== 'Helvetica') {
                        koreanFontBold = koreanFont;
                    }
                }
            } else if (koreanFont !== 'Helvetica') {
                // Bold 폰트가 없으면 Regular 폰트를 Bold로도 사용
                koreanFontBold = koreanFont;
            }

            // PDF 파일 스트림 생성
            const stream = fs.createWriteStream(pdfFilePath);
            doc.pipe(stream);

            // HTML을 파싱해서 PDF로 변환
            this.renderHTMLToPDF(doc, htmlContent, koreanFont, koreanFontBold);

            // PDF 완료
            doc.end();

            // 스트림이 완료될 때까지 대기
            await new Promise((resolve, reject) => {
                stream.on('finish', () => {
                    console.log(`✅ PDF 변환 완료: ${pdfFilePath}`);
                    resolve();
                });
                stream.on('error', (error) => {
                    console.error('PDF 스트림 오류:', error);
                    reject(error);
                });
            });

            // 파일이 실제로 생성되었는지 확인
            if (!fs.existsSync(pdfFilePath)) {
                throw new Error('PDF 파일이 생성되지 않았습니다');
            }

            return {
                success: true,
                filePath: pdfFilePath,
                fileName: pdfFileName,
                fileSize: fs.statSync(pdfFilePath).size,
                url: `/reports/${pdfFileName}`
            };

        } catch (error) {
            console.error('❌ PDF 변환 오류:', error);
            console.error('오류 상세:', error.stack);
            return {
                success: false,
                error: error.message || 'PDF 변환 중 알 수 없는 오류가 발생했습니다'
            };
        }
    }

    /**
     * HTML을 PDF로 렌더링
     * @param {PDFDocument} doc - PDF 문서 객체
     * @param {string} html - HTML 텍스트
     * @param {string} koreanFont - 한글 폰트 이름
     * @param {string} koreanFontBold - 한글 볼드 폰트 이름
     */
    renderHTMLToPDF(doc, html, koreanFont = 'Helvetica', koreanFontBold = 'Helvetica-Bold') {
        const dom = parseDocument(html);
        
        const processNode = (node) => {
            if (!node) return;
            
            // 텍스트 노드 처리
            if (node.type === 'text') {
                const text = node.data;
                if (text && text.trim()) {
                    // 한글이 포함되어 있는지 확인
                    const hasKorean = /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(text);
                    const currentFont = doc._font ? doc._font.name : koreanFont;
                    
                    // 한글이 있고 현재 폰트가 Helvetica 계열이면 한글 폰트 사용
                    if (hasKorean && (currentFont === 'Helvetica' || currentFont === 'Helvetica-Bold')) {
                        // 현재가 볼드면 볼드 폰트, 아니면 일반 폰트
                        const targetFont = currentFont === 'Helvetica-Bold' ? koreanFontBold : koreanFont;
                        if (targetFont !== 'Helvetica' && targetFont !== 'Helvetica-Bold') {
                            doc.font(targetFont);
                        }
                    }
                    
                    // 연속된 텍스트는 계속 이어서 출력
                    doc.text(text, { continued: true });
                }
            }
            // 태그 노드 처리
            else if (node.type === 'tag') {
                const tagName = node.name.toLowerCase();
                
                // 제목 처리
                if (tagName.match(/^h[1-6]$/)) {
                    const level = parseInt(tagName[1]);
                    const fontSize = 24 - (level - 1) * 2;
                    doc.moveDown(1)
                       .font(koreanFontBold)
                       .fontSize(fontSize);
                    // 자식 노드 처리
                    if (node.children) {
                        node.children.forEach(processNode);
                    }
                    doc.font(koreanFont)
                       .fontSize(12)
                       .moveDown(0.5);
                }
                // 단락 처리
                else if (tagName === 'p') {
                    doc.moveDown(0.5);
                    doc.font(koreanFont); // 기본 폰트 설정
                    if (node.children) {
                        node.children.forEach(processNode);
                    }
                    doc.moveDown(0.5);
                }
                // 강조 처리 (볼드) - **텍스트** 또는 <strong>텍스트</strong>
                else if (tagName === 'strong' || tagName === 'b') {
                    // 현재 폰트 저장
                    const prevFont = doc._font ? doc._font.name : koreanFont;
                    // 볼드 폰트로 변경
                    doc.font(koreanFontBold);
                    // 자식 노드 처리
                    if (node.children) {
                        node.children.forEach(processNode);
                    }
                    // 원래 폰트로 복원
                    doc.font(prevFont);
                }
                else if (tagName === 'em' || tagName === 'i') {
                    doc.font('Helvetica-Oblique');
                    if (node.children) {
                        node.children.forEach(processNode);
                    }
                    doc.font(koreanFont);
                }
                // 리스트 처리
                else if (tagName === 'ul' || tagName === 'ol') {
                    doc.moveDown(0.3);
                    if (node.children) {
                        node.children.forEach(processNode);
                    }
                    doc.moveDown(0.5);
                }
                else if (tagName === 'li') {
                    doc.font(koreanFont); // 리스트 항목도 한글 폰트 사용
                    doc.text('• ', { continued: true });
                    if (node.children) {
                        node.children.forEach(processNode);
                    }
                    doc.text('', { continued: false })
                       .moveDown(0.2);
                }
                // 링크 처리 (텍스트만 표시)
                else if (tagName === 'a') {
                    if (node.children) {
                        node.children.forEach(processNode);
                    }
                }
                // 줄바꿈
                else if (tagName === 'br') {
                    doc.moveDown(0.5);
                }
                // 코드 블록
                else if (tagName === 'code') {
                    doc.font('Courier')
                       .fontSize(10);
                    if (node.children) {
                        node.children.forEach(processNode);
                    }
                    doc.font(koreanFont)
                       .fontSize(12);
                }
                else if (tagName === 'pre') {
                    doc.moveDown(0.5)
                       .font('Courier')
                       .fontSize(10);
                    if (node.children) {
                        node.children.forEach(processNode);
                    }
                    doc.font(koreanFont)
                       .fontSize(12)
                       .moveDown(0.5);
                }
                // 수평선
                else if (tagName === 'hr') {
                    doc.moveDown(0.5)
                       .moveTo(54, doc.y)
                       .lineTo(540, doc.y)
                       .stroke()
                       .moveDown(0.5);
                }
                // 기타 태그는 자식 노드만 처리
                else {
                    if (node.children) {
                        node.children.forEach(processNode);
                    }
                }
            }
        };

        // DOM 트리 순회
        if (dom && dom.children) {
            dom.children.forEach(processNode);
        }
    }

    /**
     * 마크다운을 HTML로 변환 (미리보기용)
     * @param {string} markdown - 마크다운 텍스트
     * @returns {string} HTML 텍스트
     */
    convertToHTML(markdown) {
        try {
            return this.md.render(markdown);
        } catch (error) {
            console.error('마크다운 HTML 변환 오류:', error);
            return `<div class="error">마크다운 변환 중 오류가 발생했습니다: ${error.message}</div>`;
        }
    }

    /**
     * PDF 파일 삭제
     * @param {string} fileName - 파일명
     * @returns {boolean} 삭제 성공 여부
     */
    deletePDF(fileName) {
        try {
            const filePath = path.join(this.reportsDir, fileName);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                return true;
            }
            return false;
        } catch (error) {
            console.error('PDF 파일 삭제 오류:', error);
            return false;
        }
    }

    /**
     * 오래된 PDF 파일 정리 (선택사항)
     * @param {number} daysToKeep - 보관할 일수
     */
    async cleanupOldPDFs(daysToKeep = 30) {
        try {
            const files = fs.readdirSync(this.reportsDir);
            const now = Date.now();
            const maxAge = daysToKeep * 24 * 60 * 60 * 1000;

            let deletedCount = 0;
            files.forEach(file => {
                if (file.endsWith('.pdf')) {
                    const filePath = path.join(this.reportsDir, file);
                    const stats = fs.statSync(filePath);
                    const age = now - stats.mtimeMs;

                    if (age > maxAge) {
                        fs.unlinkSync(filePath);
                        deletedCount++;
                    }
                }
            });

            console.log(`🧹 오래된 PDF 파일 ${deletedCount}개 삭제 완료`);
            return deletedCount;
        } catch (error) {
            console.error('PDF 파일 정리 오류:', error);
            return 0;
        }
    }
}

module.exports = PDFGenerator;

