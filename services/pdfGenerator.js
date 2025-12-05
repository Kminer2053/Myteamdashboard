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
        
        // 보고서 디렉토리 생성
        if (!fs.existsSync(this.reportsDir)) {
            fs.mkdirSync(this.reportsDir, { recursive: true });
        }
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

            // PDF 파일 스트림 생성
            const stream = fs.createWriteStream(pdfFilePath);
            doc.pipe(stream);

            // HTML을 파싱해서 PDF로 변환
            this.renderHTMLToPDF(doc, htmlContent);

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
     */
    renderHTMLToPDF(doc, html) {
        const dom = parseDocument(html);
        
        const processNode = (node) => {
            if (!node) return;
            
            // 텍스트 노드 처리
            if (node.type === 'text') {
                const text = node.data;
                if (text && text.trim()) {
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
                       .font('Helvetica-Bold')
                       .fontSize(fontSize);
                    // 자식 노드 처리
                    if (node.children) {
                        node.children.forEach(processNode);
                    }
                    doc.font('Helvetica')
                       .fontSize(12)
                       .moveDown(0.5);
                }
                // 단락 처리
                else if (tagName === 'p') {
                    doc.moveDown(0.5);
                    if (node.children) {
                        node.children.forEach(processNode);
                    }
                    doc.moveDown(0.5);
                }
                // 강조 처리
                else if (tagName === 'strong' || tagName === 'b') {
                    doc.font('Helvetica-Bold');
                    if (node.children) {
                        node.children.forEach(processNode);
                    }
                    doc.font('Helvetica');
                }
                else if (tagName === 'em' || tagName === 'i') {
                    doc.font('Helvetica-Oblique');
                    if (node.children) {
                        node.children.forEach(processNode);
                    }
                    doc.font('Helvetica');
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
                    doc.font('Helvetica')
                       .fontSize(12);
                }
                else if (tagName === 'pre') {
                    doc.moveDown(0.5)
                       .font('Courier')
                       .fontSize(10);
                    if (node.children) {
                        node.children.forEach(processNode);
                    }
                    doc.font('Helvetica')
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

