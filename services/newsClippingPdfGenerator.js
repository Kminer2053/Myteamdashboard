const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

class NewsClippingPdfGenerator {
    constructor() {
        this.reportsDir = path.join(__dirname, '../reports');
        this.fontsDir = path.join(__dirname, '../fonts');
        
        // 보고서 디렉토리 생성
        if (!fs.existsSync(this.reportsDir)) {
            fs.mkdirSync(this.reportsDir, { recursive: true });
        }
        
        // 한글 폰트 경로 설정
        const isValidFontFile = (fontPath) => {
            if (!fs.existsSync(fontPath)) return false;
            try {
                const fontBuffer = fs.readFileSync(fontPath);
                if (fontBuffer.length < 1024) return false;
                const signature = fontBuffer.slice(0, 4);
                const isOTF = signature[0] === 0x4F && signature[1] === 0x54 && signature[2] === 0x54 && signature[3] === 0x4F;
                const isTTF = (signature[0] === 0x00 && signature[1] === 0x01 && signature[2] === 0x00 && signature[3] === 0x00) ||
                             (signature[0] === 0x4C && signature[1] === 0x50);
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
     * 뉴스 클리핑 텍스트를 PDF로 변환
     * @param {string} content - 뉴스 클리핑 텍스트
     * @param {string} filename - 파일명 (확장자 제외)
     * @returns {Promise<Object>} PDF 파일 정보
     */
    async convertToPDF(content, filename = null) {
        try {
            console.log('[뉴스 클리핑 PDF] 변환 시작...');
            
            // 파일명 생성
            const timestamp = Date.now();
            const pdfFileName = filename 
                ? `${filename}-${timestamp}.pdf`
                : `news-clipping-${timestamp}.pdf`;
            const pdfFilePath = path.join(this.reportsDir, pdfFileName);

            // PDF 문서 생성
            const doc = new PDFDocument({
                size: 'A4',
                margins: {
                    top: 72,
                    bottom: 72,
                    left: 54,
                    right: 54
                },
                lineGap: 2,
                info: {
                    Title: '뉴스 클리핑',
                    Author: '코레일유통 뉴스클리핑 시스템',
                    Subject: '주요 뉴스 브리핑',
                    Creator: '뉴스 클리핑 시스템',
                    Producer: 'PDFKit'
                }
            });

            // 한글 폰트 등록
            let koreanFont = 'Helvetica';
            let koreanFontBold = 'Helvetica-Bold';
            
            if (this.koreanFontPath) {
                try {
                    const fontBuffer = fs.readFileSync(this.koreanFontPath);
                    if (fontBuffer.length >= 1024) {
                        doc.registerFont('Korean', this.koreanFontPath);
                        koreanFont = 'Korean';
                        console.log(`[뉴스 클리핑 PDF] 한글 폰트 등록 완료: ${this.koreanFontPath}`);
                    }
                } catch (error) {
                    console.error('[뉴스 클리핑 PDF] 한글 폰트 등록 실패:', error.message);
                }
            }
            
            if (this.koreanFontBoldPath) {
                try {
                    const fontBuffer = fs.readFileSync(this.koreanFontBoldPath);
                    if (fontBuffer.length >= 1024) {
                        doc.registerFont('KoreanBold', this.koreanFontBoldPath);
                        koreanFontBold = 'KoreanBold';
                        console.log(`[뉴스 클리핑 PDF] 한글 볼드 폰트 등록 완료: ${this.koreanFontBoldPath}`);
                    }
                } catch (error) {
                    console.error('[뉴스 클리핑 PDF] 한글 볼드 폰트 등록 실패:', error.message);
                    if (koreanFont !== 'Helvetica') {
                        koreanFontBold = koreanFont;
                    }
                }
            } else if (koreanFont !== 'Helvetica') {
                koreanFontBold = koreanFont;
            }

            // PDF 파일 스트림 생성
            const stream = fs.createWriteStream(pdfFilePath);
            doc.pipe(stream);

            // 뉴스 클리핑 텍스트를 PDF로 렌더링
            this.renderNewsClippingToPDF(doc, content, koreanFont, koreanFontBold);

            // PDF 완료
            doc.end();

            // 스트림이 완료될 때까지 대기
            await new Promise((resolve, reject) => {
                stream.on('finish', () => {
                    console.log(`[뉴스 클리핑 PDF] 변환 완료: ${pdfFilePath}`);
                    resolve();
                });
                stream.on('error', (error) => {
                    console.error('[뉴스 클리핑 PDF] 스트림 오류:', error);
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
            console.error('[뉴스 클리핑 PDF] 변환 오류:', error);
            console.error('오류 상세:', error.stack);
            return {
                success: false,
                error: error.message || 'PDF 변환 중 알 수 없는 오류가 발생했습니다'
            };
        }
    }

    /**
     * 뉴스 클리핑 텍스트를 PDF로 렌더링 (기존 대시보드 방식 사용)
     * @param {PDFDocument} doc - PDF 문서 객체
     * @param {string} content - 뉴스 클리핑 텍스트
     * @param {string} koreanFont - 한글 폰트 이름
     * @param {string} koreanFontBold - 한글 볼드 폰트 이름
     */
    renderNewsClippingToPDF(doc, content, koreanFont = 'Helvetica', koreanFontBold = 'Helvetica-Bold') {
        const maxWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
        let inSummaryPage = true;
        let currentArticleUrl = null;

        // 페이지 넘김 체크 (기존 대시보드 방식)
        const checkPageBreak = () => {
            const pageHeight = doc.page.height;
            const bottomMargin = doc.page.margins.bottom;
            if (doc.y > pageHeight - bottomMargin - 50) {
                doc.addPage();
                return true;
            }
            return false;
        };

        // 텍스트 렌더링 (기존 대시보드 방식)
        const renderText = (text, fontSize, isBold = false, align = 'left', spacing = 1.0) => {
            if (!text || text.trim().length === 0) return;
            
            checkPageBreak();
            doc.font(isBold ? koreanFontBold : koreanFont)
               .fontSize(fontSize);
            
            if (align === 'center') {
                doc.text(text, {
                    align: 'center',
                    width: maxWidth
                });
            } else {
                doc.text(text, {
                    width: maxWidth,
                    lineGap: fontSize * 0.2
                });
            }
            
            doc.moveDown(spacing);
        };

        // 스트리밍 처리: split 대신 라인 단위로 처리하여 메모리 효율성 향상
        let lineStart = 0;
        let lineEnd = 0;
        
        while (lineEnd < content.length) {
            // 다음 줄바꿈 찾기
            lineEnd = content.indexOf('\n', lineStart);
            if (lineEnd === -1) {
                lineEnd = content.length;
            }
            
            const line = content.substring(lineStart, lineEnd).trim();
            lineStart = lineEnd + 1;
            
            // 빈 줄 처리
            if (!line) {
                if (inSummaryPage) {
                    doc.moveDown(0.5);
                } else {
                    doc.moveDown(0.3);
                }
                continue;
            }

            // 1페이지 요약 페이지와 상세 페이지 구분
            if (line.startsWith('* 각 뉴스 상세 페이지')) {
                inSummaryPage = false;
                doc.addPage(); // 상세 페이지 시작
                continue;
            }

            // 1페이지 요약 페이지 처리
            if (inSummaryPage) {
                // "주요 뉴스 브리핑" 제목
                if (line === '주요 뉴스 브리핑') {
                    doc.moveDown(1.5);
                    renderText(line, 24, true, 'center', 1.5);
                    continue;
                }

                // 헤더 문자열 (날짜 정보)
                if (line.match(/^\[.*\]$/)) {
                    renderText(line, 11, false, 'center', 1.0);
                    continue;
                }

                // 카테고리 제목 (☐로 시작)
                if (line.startsWith('☐ ')) {
                    doc.moveDown(0.8);
                    renderText(line, 14, true, 'left', 0.5);
                    continue;
                }

                // 기사 항목 (○로 시작)
                if (line.startsWith('○')) {
                    renderText(line, 11, false, 'left', 0.4);
                    continue;
                }

                // 일반 텍스트
                renderText(line, 11, false, 'left', 0.4);
            }
            // 상세 페이지 처리
            else {
                // 언론사명 (새 기사 시작) - 짧은 한글 텍스트만
                if (line.match(/^[가-힣\s]+$/) && !line.includes('주요') && !line.includes('뉴스') && 
                    !line.includes('브리핑') && line.length < 20 && !line.startsWith('☐') && !line.startsWith('○')) {
                    
                    // 이전 기사 URL 추가
                    if (currentArticleUrl) {
                        doc.moveDown(0.5);
                        doc.font(koreanFont).fontSize(9);
                        doc.fillColor('blue');
                        doc.text(currentArticleUrl, {
                            width: maxWidth,
                            lineGap: 2
                        });
                        doc.fillColor('black');
                        doc.moveDown(1.0);
                    }
                    
                    // 새 페이지에서 새 기사 시작
                    doc.addPage();
                    currentArticleUrl = null;
                    
                    renderText(line, 12, false, 'left', 1.0);
                    continue;
                }

                // URL 추출 (http:// 또는 https://로 시작)
                if (line.match(/^https?:\/\//)) {
                    currentArticleUrl = line;
                    continue;
                }

                // 기사 제목 (볼드체로 크게) - 첫 번째 긴 줄
                if (!currentArticleUrl && line.length > 5 && !line.match(/^https?:\/\//)) {
                    renderText(line, 16, true, 'left', 1.0);
                    continue;
                }

                // 기사 내용
                if (line.length > 0) {
                    renderText(line, 11, false, 'left', 0.5);
                }
            }
        }

        // 마지막 기사 URL 추가
        if (currentArticleUrl) {
            doc.moveDown(0.5);
            doc.font(koreanFont).fontSize(9);
            doc.fillColor('blue');
            doc.text(currentArticleUrl, {
                width: maxWidth,
                lineGap: 2
            });
            doc.fillColor('black');
        }
    }
}

module.exports = NewsClippingPdfGenerator;
