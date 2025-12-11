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
        let publisherNumber = 0; // 언론사명 넘버링용

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
        const renderText = (text, fontSize, isBold = false, align = 'left', spacing = 1.0, color = 'black') => {
            if (!text || text.trim().length === 0) return;
            
            checkPageBreak();
            doc.font(isBold ? koreanFontBold : koreanFont)
               .fontSize(fontSize)
               .fillColor(color);
            
            if (align === 'center') {
                doc.text(text, {
                    align: 'center',
                    width: maxWidth
                });
            } else if (align === 'right') {
                doc.text(text, {
                    align: 'right',
                    width: maxWidth
                });
            } else {
                doc.text(text, {
                    width: maxWidth,
                    lineGap: fontSize * 0.2
                });
            }
            
            doc.moveDown(spacing);
            doc.fillColor('black'); // 색상 초기화
        };

        // 스트리밍 처리: split 대신 라인 단위로 처리하여 메모리 효율성 향상
        let lineStart = 0;
        let lineEnd = 0;
        let prevLineEmpty = false; // 연속된 빈 줄 감지용
        
        while (lineEnd < content.length) {
            // 다음 줄바꿈 찾기
            lineEnd = content.indexOf('\n', lineStart);
            if (lineEnd === -1) {
                lineEnd = content.length;
            }
            
            const line = content.substring(lineStart, lineEnd).trim();
            const isEmpty = !line;
            lineStart = lineEnd + 1;
            
            // 상세 페이지 자동 감지: 요약 페이지에서 언론사명이 나오면 상세 페이지로 전환
            if (inSummaryPage) {
                const isPublisherName = line.match(/^[가-힣][가-힣\s\d\w]*$/) && 
                    !line.includes('주요') && !line.includes('브리핑') && 
                    line.length < 20 && !line.startsWith('☐') && !line.startsWith('○') &&
                    !line.startsWith('**') && line !== '---' && !line.match(/^\(URL/) &&
                    !line.match(/^https?:\/\//) && !line.match(/^\(URL 생략/);
                
                if (isPublisherName && !isEmpty) {
                    inSummaryPage = false;
                    publisherNumber = 0;
                    doc.addPage(); // 상세 페이지 시작
                }
            }
            
            // 빈 줄 처리
            if (isEmpty) {
                // 연속된 빈 줄이면 기사가 끝난 것으로 보고 URL 출력
                if (prevLineEmpty && !inSummaryPage && currentArticleUrl) {
                    doc.moveDown(0.5);
                    doc.font(koreanFont).fontSize(9);
                    doc.fillColor('blue');
                    doc.text(currentArticleUrl, {
                        width: maxWidth,
                        lineGap: 2,
                        link: currentArticleUrl
                    });
                    doc.fillColor('black');
                    doc.moveDown(1.0);
                    currentArticleUrl = null;
                }
                
                if (inSummaryPage) {
                    doc.moveDown(0.5);
                } else {
                    doc.moveDown(0.3);
                }
                prevLineEmpty = true;
                continue;
            }
            
            prevLineEmpty = false;

            // 1페이지 요약 페이지와 상세 페이지 구분
            // --- 구분선 또는 "* 각 뉴스 상세 페이지" 마커
            if (line === '---' || line.startsWith('* 각 뉴스 상세 페이지')) {
                inSummaryPage = false;
                publisherNumber = 0;
                doc.addPage(); // 상세 페이지 시작
                continue;
            }

            // 1페이지 요약 페이지 처리
            if (inSummaryPage) {
                // "주요 뉴스 브리핑" 제목
                if (line === '주요 뉴스 브리핑' || line.trim() === '주요 뉴스 브리핑') {
                    doc.moveDown(1.5);
                    renderText('주요 뉴스 브리핑', 24, true, 'center', 1.5);
                    continue;
                }

                // 헤더 문자열 (날짜 정보) - [ ] 형식 또는 일반 날짜 형식 - 오른쪽 정렬
                if (line.match(/^\[.*\]$/) || line.match(/^\d{2}\.\d{2}\.\d{2}\./)) {
                    renderText(line, 11, false, 'right', 1.0);
                    continue;
                }

                // 카테고리 제목 (☐로 시작하거나 ☐ **...** 형식) - 전체 볼드 처리
                // ☐ 문자를 폰트 문제 방지를 위해 "□" (WHITE SQUARE) 또는 "[ ]"로 대체
                const checkboxChar = '□'; // WHITE SQUARE (U+25A1) - 더 넓은 폰트 지원
                const categoryMatch1 = line.match(/^☐\s*\*\*(.+?)\*\*/);
                const categoryMatch2 = line.match(/^\*\*☐\s*(.+?)\*\*/);
                if (categoryMatch1) {
                    // 형식: ☐ **카테고리명** (전체 볼드)
                    doc.moveDown(0.8);
                    renderText(`${checkboxChar} ${categoryMatch1[1]}`, 14, true, 'left', 0.5);
                    continue;
                } else if (categoryMatch2) {
                    // 형식: **☐ 카테고리명** (전체 볼드)
                    doc.moveDown(0.8);
                    renderText(`${checkboxChar} ${categoryMatch2[1]}`, 14, true, 'left', 0.5);
                    continue;
                } else if (line.startsWith('☐ ')) {
                    // 일반 형식: ☐ 카테고리명 (마크다운 제거 후 전체 볼드)
                    const cleanCategory = line.replace(/\*\*(.*?)\*\*/g, '$1').replace(/^☐/, checkboxChar);
                    doc.moveDown(0.8);
                    renderText(cleanCategory, 14, true, 'left', 0.5);
                    continue;
                }

                // 기사 항목 (○로 시작) - 주석 표기 제거
                if (line.startsWith('○')) {
                    // [1], [2] 같은 주석 표기 제거
                    const cleanedLine = line.replace(/\[\d+\]/g, '');
                    renderText(cleanedLine, 11, false, 'left', 0.4);
                    continue;
                }

                // 일반 텍스트 (마크다운 제거)
                const cleanLine = line.replace(/\*\*(.*?)\*\*/g, '$1');
                renderText(cleanLine, 11, false, 'left', 0.4);
            }
            // 상세 페이지 처리
            else {
                // 언론사명 (새 기사 시작) - 한글, 숫자, 영문 포함 가능 - 넘버링 추가
                // 이미 넘버링이 있는 경우(예: "2. 서울경제")도 처리
                const hasExistingNumber = line.match(/^\d+\.\s*(.+)$/);
                let publisherNameOnly = hasExistingNumber ? hasExistingNumber[1] : line;
                // 괄호와 그 안의 내용 제거 (예: "택스저널(택스타임즈)" -> "택스저널")
                publisherNameOnly = publisherNameOnly.replace(/\s*\([^)]*\)\s*$/, '').trim();
                
                // 한글, 영문, 영문+한글 조합 모두 허용
                const isKoreanPublisher = publisherNameOnly.match(/^[가-힣][가-힣\s\d\w]*$/);
                const isEnglishPublisher = publisherNameOnly.match(/^[A-Z][A-Z0-9]{1,10}$/);
                const isMixedPublisher = publisherNameOnly.match(/^[A-Z][A-Z0-9]*[가-힣][가-힣\s\d\w]*$/);
                const isPublisherName = (isKoreanPublisher || isEnglishPublisher || isMixedPublisher) && 
                    !publisherNameOnly.includes('주요') && !publisherNameOnly.includes('브리핑') && 
                    !publisherNameOnly.includes('뉴스 상세') && !publisherNameOnly.includes('상세') && 
                    publisherNameOnly.length < 20 && !publisherNameOnly.startsWith('☐') && !publisherNameOnly.startsWith('○') &&
                    !publisherNameOnly.startsWith('**') && publisherNameOnly !== '---' && !publisherNameOnly.match(/^\(URL/) &&
                    !publisherNameOnly.match(/^https?:\/\//) && !publisherNameOnly.match(/^\(URL 생략/) &&
                    !publisherNameOnly.match(/^URL:/i);
                
                if (isPublisherName) {
                    // 이전 기사 URL 출력 (새 기사 시작 전)
                    if (currentArticleUrl) {
                        doc.moveDown(0.5);
                        doc.font(koreanFont).fontSize(9);
                        doc.fillColor('blue');
                        doc.text(currentArticleUrl, {
                            width: maxWidth,
                            lineGap: 2,
                            link: currentArticleUrl
                        });
                        doc.fillColor('black');
                        doc.moveDown(1.0);
                        currentArticleUrl = null;
                    }
                    
                    // 새 기사는 새 페이지에서 시작
                    // 단, 이미 페이지 상단 근처면 빈 페이지를 추가하지 않음
                    const pageHeight = doc.page.height;
                    const topMargin = doc.page.margins.top;
                    const currentY = doc.y;
                    
                    // 현재 위치가 페이지 상단 근처(첫 100px 이내)가 아니면 새 페이지 추가
                    // 상단 근처면 이미 새 페이지이므로 여백만 추가
                    if (currentY > topMargin + 100) {
                        // 페이지 중간이나 하단이면 새 페이지 추가
                        doc.addPage();
                    } else {
                        // 이미 페이지 상단 근처면 여백만 추가 (빈 페이지 방지)
                        doc.moveDown(1.5);
                    }
                    
                    publisherNumber++;
                    renderText(`${publisherNumber}. ${publisherNameOnly}`, 12, false, 'left', 1.0);
                    continue;
                }

                // URL 추출 및 출력 (http:// 또는 https://로 시작)
                // "URL: https://..." 형식도 처리
                const urlMatch = line.match(/^URL:\s*(https?:\/\/.+)$/i);
                if (urlMatch) {
                    // 기사 내용 다음에 URL 출력
                    doc.moveDown(0.5);
                    doc.font(koreanFont).fontSize(9);
                    doc.fillColor('blue');
                    doc.text(urlMatch[1], {
                        width: maxWidth,
                        lineGap: 2,
                        link: urlMatch[1]
                    });
                    doc.fillColor('black');
                    doc.moveDown(1.0);
                    currentArticleUrl = null;
                    continue;
                }
                
                if (line.match(/^https?:\/\//)) {
                    // 기사 내용 다음에 URL 출력
                    doc.moveDown(0.5);
                    doc.font(koreanFont).fontSize(9);
                    doc.fillColor('blue');
                    doc.text(line, {
                        width: maxWidth,
                        lineGap: 2,
                        link: line
                    });
                    doc.fillColor('black');
                    doc.moveDown(1.0);
                    currentArticleUrl = null; // 출력했으므로 초기화
                    continue;
                }

                // URL 생략 메시지
                if (line.match(/^\(URL 생략/)) {
                    doc.moveDown(0.5);
                    doc.font(koreanFont).fontSize(9);
                    doc.fillColor('#666');
                    doc.font('Helvetica-Italic');
                    doc.text(line, {
                        width: maxWidth,
                        lineGap: 2
                    });
                    doc.font(koreanFont);
                    doc.fillColor('black');
                    doc.moveDown(1.0);
                    continue;
                }

                // 기사 제목 (**...** 형식) - 주석 표기 제거
                const titleMatch = line.match(/\*\*(.+?)\*\*/);
                if (titleMatch) {
                    // 제목에서 주석 표기 제거
                    const cleanedTitle = titleMatch[1].replace(/\[\d+\]/g, '');
                    renderText(cleanedTitle, 16, true, 'left', 1.0);
                    continue;
                }

                // 기사 내용 - 주석 표기 제거
                if (line.length > 0 && line !== '---') {
                    // [1], [2] 같은 주석 표기 제거
                    let cleanLine = line.replace(/\[\d+\]/g, '');
                    // 마크다운 볼드체 제거
                    cleanLine = cleanLine.replace(/\*\*(.*?)\*\*/g, '$1');
                    renderText(cleanLine, 11, false, 'left', 0.5);
                }
            }
        }

        // 마지막 기사 URL 추가 (파일 끝에 도달했을 때)
        if (currentArticleUrl) {
            doc.moveDown(0.5);
            doc.font(koreanFont).fontSize(9);
            doc.fillColor('blue');
            doc.text(currentArticleUrl, {
                width: maxWidth,
                lineGap: 2,
                link: currentArticleUrl
            });
            doc.fillColor('black');
        }
    }
}

module.exports = NewsClippingPdfGenerator;
