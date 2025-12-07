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
     * 뉴스 클리핑 텍스트를 PDF로 렌더링
     * @param {PDFDocument} doc - PDF 문서 객체
     * @param {string} content - 뉴스 클리핑 텍스트
     * @param {string} koreanFont - 한글 폰트 이름
     * @param {string} koreanFontBold - 한글 볼드 폰트 이름
     */
    renderNewsClippingToPDF(doc, content, koreanFont = 'Helvetica', koreanFontBold = 'Helvetica-Bold') {
        const lines = content.split('\n');
        const pageHeight = doc.page.height;
        const margin = 54;
        const maxWidth = doc.page.width - (margin * 2);
        let y = margin;
        const lineHeight = 14;
        const categorySpacing = 8;
        const articleSpacing = 4;

        // 페이지 넘김 체크 함수
        const checkPageBreak = (requiredSpace = lineHeight) => {
            if (y + requiredSpace > pageHeight - margin) {
                doc.addPage();
                y = margin;
                return true;
            }
            return false;
        };

        // 텍스트 렌더링 함수 (자동 줄바꿈)
        const renderText = (text, font, fontSize, isBold = false, align = 'left') => {
            const currentFont = isBold ? koreanFontBold : font;
            doc.font(currentFont).fontSize(fontSize);
            
            const splitText = doc.splitTextToSize(text, maxWidth);
            const textHeight = splitText.length * fontSize * 1.2;
            
            checkPageBreak(textHeight);
            
            splitText.forEach((line, index) => {
                if (index > 0) {
                    y += fontSize * 1.2;
                    checkPageBreak();
                }
                doc.text(line, margin, y, { align, width: maxWidth });
            });
            
            y += textHeight;
            return textHeight;
        };

        let i = 0;
        let inSummaryPage = true;
        let currentCategory = null;
        let inDetailPage = false;
        let currentArticle = { source: '', title: '', content: '', url: '' };

        while (i < lines.length) {
            const line = lines[i].trim();
            
            // 빈 줄 처리
            if (!line) {
                if (inSummaryPage && currentCategory) {
                    y += articleSpacing;
                } else if (inDetailPage) {
                    y += lineHeight / 2;
                } else {
                    y += lineHeight / 2;
                }
                checkPageBreak();
                i++;
                continue;
            }

            // 1페이지 요약 페이지와 상세 페이지 구분
            if (line.startsWith('* 각 뉴스 상세 페이지')) {
                inSummaryPage = false;
                i++;
                continue;
            }

            // 1페이지 요약 페이지 처리
            if (inSummaryPage) {
                // "주요 뉴스 브리핑" 제목
                if (line === '주요 뉴스 브리핑') {
                    y += 20;
                    checkPageBreak(30);
                    renderText(line, koreanFont, 24, true, 'center');
                    y += 10;
                    continue;
                }

                // 헤더 문자열 (날짜 정보)
                if (line.match(/^\[.*\]$/)) {
                    checkPageBreak(20);
                    renderText(line, koreanFont, 11, false, 'center');
                    y += 15;
                    continue;
                }

                // 카테고리 제목 (☐로 시작)
                if (line.startsWith('☐ ')) {
                    const categoryName = line.substring(2).trim();
                    y += categorySpacing;
                    checkPageBreak(25);
                    renderText(line, koreanFont, 14, true);
                    y += 5;
                    currentCategory = categoryName;
                    continue;
                }

                // 기사 항목 (○로 시작)
                if (line.startsWith('○')) {
                    checkPageBreak(20);
                    renderText(line, koreanFont, 11, false);
                    y += articleSpacing;
                    continue;
                }

                // 일반 텍스트
                renderText(line, koreanFont, 11, false);
                y += articleSpacing;
            }
            // 상세 페이지 처리
            else {
                // 언론사명 (새 기사 시작)
                if (line.match(/^[가-힣\s]+$/) && !line.includes('주요') && !line.includes('뉴스') && 
                    !line.includes('브리핑') && line.length < 20 && !inDetailPage) {
                    // 이전 기사가 있으면 URL 추가 후 새 페이지
                    if (currentArticle.source && currentArticle.title) {
                        if (currentArticle.url) {
                            y += lineHeight;
                            checkPageBreak();
                            doc.font(koreanFont).fontSize(9);
                            doc.fillColor('blue');
                            const urlText = doc.splitTextToSize(currentArticle.url, maxWidth);
                            urlText.forEach((urlLine) => {
                                checkPageBreak();
                                doc.text(urlLine, margin, y, { width: maxWidth });
                                y += 12;
                            });
                            doc.fillColor('black');
                        }
                        doc.addPage();
                        y = margin;
                    }
                    
                    currentArticle = { source: line, title: '', content: '', url: '' };
                    inDetailPage = true;
                    y += 20;
                    checkPageBreak(30);
                    renderText(line, koreanFont, 12, false);
                    y += 10;
                    continue;
                }

                // 기사 제목 (볼드체로 크게)
                if (inDetailPage && currentArticle.source && !currentArticle.title && line.length > 5) {
                    currentArticle.title = line;
                    checkPageBreak(30);
                    renderText(line, koreanFont, 16, true);
                    y += 10;
                    continue;
                }

                // URL 추출 (http:// 또는 https://로 시작)
                if (line.match(/^https?:\/\//)) {
                    currentArticle.url = line;
                    continue;
                }

                // 기사 내용
                if (inDetailPage && currentArticle.title) {
                    // URL이 포함된 줄은 건너뛰기 (이미 추출함)
                    if (line.match(/^https?:\/\//)) {
                        i++;
                        continue;
                    }
                    
                    currentArticle.content += (currentArticle.content ? '\n' : '') + line;
                    renderText(line, koreanFont, 11, false);
                    y += articleSpacing;
                }
            }

            i++;
        }

        // 마지막 기사 URL 추가
        if (currentArticle.source && currentArticle.title && currentArticle.url) {
            y += lineHeight;
            checkPageBreak();
            doc.font(koreanFont).fontSize(9);
            doc.fillColor('blue');
            const urlText = doc.splitTextToSize(currentArticle.url, maxWidth);
            urlText.forEach((urlLine) => {
                checkPageBreak();
                doc.text(urlLine, margin, y, { width: maxWidth });
                y += 12;
            });
            doc.fillColor('black');
        }
    }
}

module.exports = NewsClippingPdfGenerator;

