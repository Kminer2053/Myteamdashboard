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
            typographer: false // 큰따옴표 특수 문자 변환 방지
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
        
        // 이모지 폰트 경로 설정
        const emojiFontPaths = [
            path.join(this.fontsDir, 'NotoEmoji-VariableFont_wght.ttf'),
            path.join(this.fontsDir, 'NotoColorEmoji.ttf'),
            path.join(this.fontsDir, 'NotoEmoji.ttf')
        ];
        this.emojiFontPath = emojiFontPaths.find(p => isValidFontFile(p));
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
                },
                lineGap: 2       // 줄 간격 추가
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
            
            // 이모지 폰트 등록
            let emojiFont = null;
            if (this.emojiFontPath) {
                try {
                    // 폰트 파일 유효성 확인
                    const fontBuffer = fs.readFileSync(this.emojiFontPath);
                    const isHTML = fontBuffer.toString('utf8', 0, Math.min(100, fontBuffer.length)).trim().toLowerCase().startsWith('<!');
                    
                    if (!isHTML && fontBuffer.length > 1024) {
                        doc.registerFont('Emoji', this.emojiFontPath);
                        emojiFont = 'Emoji';
                        console.log(`✅ 이모지 폰트 등록 완료: ${this.emojiFontPath}`);
                    } else {
                        console.warn('⚠️ 이모지 폰트 파일이 유효하지 않습니다 (HTML 파일 또는 크기 부족).');
                    }
                } catch (error) {
                    console.error('이모지 폰트 등록 실패:', error.message);
                    console.warn('⚠️ 이모지 폰트 없이 진행합니다.');
                }
            } else {
                console.warn('⚠️ 이모지 폰트 파일을 찾을 수 없습니다. 이모지는 기본 폰트로 렌더링됩니다.');
            }

            // PDF 파일 스트림 생성
            const stream = fs.createWriteStream(pdfFilePath);
            doc.pipe(stream);

            // 마크다운을 직접 PDF로 변환 (HTML 변환 단계 없이)
            // 1. 마크다운 전처리 (큰따옴표 문제 해결)
            const preprocessed = this.preprocessMarkdown(markdown);
            
            // 2. 마크다운을 직접 PDF로 렌더링
            this.renderMarkdownToPDF(doc, preprocessed, koreanFont, koreanFontBold, emojiFont);

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
        
        // 각 ol 태그별 카운터 저장
        const olCounters = new WeakMap();
        
        // 부모 노드를 찾아서 리스트 타입 확인하는 헬퍼 함수
        const findListParent = (node) => {
            let parent = node.parent;
            while (parent) {
                if (parent.type === 'tag') {
                    const tagName = parent.name.toLowerCase();
                    if (tagName === 'ul' || tagName === 'ol') {
                        return { type: tagName, node: parent };
                    }
                }
                parent = parent.parent;
            }
            return null;
        };
        
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
                    // 단, 이미 한글 폰트(koreanFont 또는 koreanFontBold)가 설정되어 있으면 변경하지 않음
                    if (hasKorean && (currentFont === 'Helvetica' || currentFont === 'Helvetica-Bold')) {
                        // 현재가 볼드면 볼드 폰트, 아니면 일반 폰트
                        const targetFont = currentFont === 'Helvetica-Bold' ? koreanFontBold : koreanFont;
                        if (targetFont !== 'Helvetica' && targetFont !== 'Helvetica-Bold') {
                            doc.font(targetFont);
                        }
                    }
                    // 이미 한글 폰트가 설정되어 있는 경우 그대로 유지 (볼드 포함)
                    
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
                    doc.moveDown(0.8)
                       .font(koreanFontBold)
                       .fontSize(fontSize);
                    // 자식 노드 처리
                    if (node.children) {
                        node.children.forEach(processNode);
                    }
                    doc.font(koreanFont)
                       .fontSize(12)
                       .moveDown(0.4);
                }
                // 단락 처리
                else if (tagName === 'p') {
                    doc.moveDown(0.4);
                    // 기본 폰트 설정 (단, 이미 설정된 폰트가 있으면 유지)
                    if (!doc._font || doc._font.name === 'Helvetica' || doc._font.name === 'Helvetica-Bold') {
                        doc.font(koreanFont);
                    }
                    doc.fontSize(12); // 폰트 크기 명시적 설정
                    if (node.children) {
                        node.children.forEach(processNode);
                    }
                    doc.moveDown(0.4);
                }
                // 강조 처리 (볼드) - **텍스트** 또는 <strong>텍스트</strong>
                else if (tagName === 'strong' || tagName === 'b') {
                    // 현재 폰트 저장
                    const prevFont = doc._font ? doc._font.name : koreanFont;
                    // 볼드 폰트로 변경 (반드시 변경)
                    doc.font(koreanFontBold);
                    // 자식 노드 처리
                    if (node.children) {
                        node.children.forEach(processNode);
                    }
                    // 원래 폰트로 복원 (이전 폰트가 한글 폰트였으면 그것으로, 아니면 일반 한글 폰트로)
                    if (prevFont === koreanFont || prevFont === koreanFontBold || prevFont === 'Korean' || prevFont === 'KoreanBold') {
                        doc.font(prevFont === koreanFontBold || prevFont === 'KoreanBold' ? koreanFontBold : koreanFont);
                    } else {
                        doc.font(koreanFont);
                    }
                }
                else if (tagName === 'em' || tagName === 'i') {
                    doc.font('Helvetica-Oblique');
                    if (node.children) {
                        node.children.forEach(processNode);
                    }
                    doc.font(koreanFont);
                }
                // 리스트 처리
                else if (tagName === 'ul') {
                    doc.moveDown(0.6);
                    if (node.children) {
                        node.children.forEach(processNode);
                    }
                    doc.moveDown(0.6);
                }
                else if (tagName === 'ol') {
                    // ol 카운터 초기화
                    olCounters.set(node, 0);
                    doc.moveDown(0.6);
                    if (node.children) {
                        node.children.forEach(processNode);
                    }
                    doc.moveDown(0.6);
                }
                else if (tagName === 'li') {
                    doc.font(koreanFont);
                    doc.fontSize(12);
                    
                    // 부모 리스트 타입 확인
                    const listParent = findListParent(node);
                    
                    // 리스트 마커 결정
                    let marker = '';
                    if (listParent && listParent.type === 'ol') {
                        // ol인 경우: 번호
                        const olNode = listParent.node;
                        const currentCount = olCounters.get(olNode) || 0;
                        olCounters.set(olNode, currentCount + 1);
                        marker = `${currentCount + 1}. `;
                    } else {
                        // ul인 경우: 원형 글머리 기호
                        marker = '• ';
                    }
                    
                    // 들여쓰기: 공백 3칸 + 마커
                    doc.text('   ' + marker, { continued: true });
                    
                    // 리스트 항목 내용 처리
                    if (node.children) {
                        node.children.forEach(processNode);
                    }
                    
                    // 줄 끝 처리 및 간격
                    doc.text('', { continued: false });
                    doc.moveDown(0.5);
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
     * 마크다운 전처리 (볼드 패턴 문제 해결)
     * @param {string} markdown - 원본 마크다운 텍스트
     * @returns {string} 전처리된 마크다운 텍스트
     */
    preprocessMarkdown(markdown) {
        let processed = markdown;
        
        // 1. **"텍스트"** 패턴: 큰따옴표 제거 (큰따옴표가 변환을 방해함)
        processed = processed.replace(/\*\*"([^"]+)"\*\*/g, '**$1**');
        
        // 2. **텍스트(내용)** 패턴: 괄호가 있는 볼드 패턴 처리
        // 이미 <strong> 태그로 변환되지 않은 경우만 처리
        // 이 단계에서는 markdown-it이 처리하도록 그대로 둠
        
        return processed;
    }

    /**
     * HTML 후처리 (볼드 패턴 문제 해결)
     * @param {string} html - 원본 HTML 텍스트
     * @returns {string} 후처리된 HTML 텍스트
     */
    postprocessHTML(html) {
        let processed = html;
        
        // 1. HTML로 변환되지 않은 **텍스트(내용)** 패턴 처리 (괄호가 있는 경우 우선)
        processed = processed.replace(/\*\*([^*]+?\([^)]+?\)[^*]*?)\*\*/g, '<strong>$1</strong>');
        
        // 2. HTML로 변환되지 않은 **"텍스트"** 패턴 처리 (큰따옴표 포함)
        processed = processed.replace(/\*\*"([^"]+)"\*\*/g, '<strong>"$1"</strong>');
        
        // 3. HTML로 변환되지 않은 **'텍스트'** 패턴 처리 (작은따옴표 포함)
        processed = processed.replace(/\*\*'([^']+)'\*\*/g, "<strong>'$1'</strong>");
        
        // 4. 일반 **텍스트** 패턴 처리 (위에서 처리되지 않은 경우)
        processed = processed.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');
        
        return processed;
    }

    /**
     * 마크다운을 직접 PDF로 렌더링
     * @param {PDFDocument} doc - PDF 문서 객체
     * @param {string} markdown - 마크다운 텍스트
     * @param {string} koreanFont - 한글 폰트 이름
     * @param {string} koreanFontBold - 한글 볼드 폰트 이름
     */
    renderMarkdownToPDF(doc, markdown, koreanFont = 'Helvetica', koreanFontBold = 'Helvetica-Bold', emojiFont = null) {
        // 마크다운 파싱
        const blocks = this.parseMarkdown(markdown);
        
        // 이전 heading 레벨 추적 (들여쓰기용)
        let lastHeadingLevel = 0;
        let lastWasSubHeading = false;
        
        // 블록 렌더링
        blocks.forEach((block, index) => {
            if (block.type === 'heading') {
                // 이전 heading 레벨 업데이트
                lastHeadingLevel = block.level;
                lastWasSubHeading = false;
                
                // 제목 위계에 따른 폰트 크기 설정 (더 명확한 차이)
                let fontSize;
                switch (block.level) {
                    case 1: fontSize = 28; break; // h1: 가장 큰 제목
                    case 2: fontSize = 20; break; // h2: 섹션 제목
                    case 3: fontSize = 16; break; // h3: 소제목
                    case 4: fontSize = 14; break; // h4
                    case 5: fontSize = 13; break; // h5
                    case 6: fontSize = 12; break; // h6
                    default: fontSize = 20;
                }
                
                // h1, h2는 특별 간격, h3~h6는 앞뒤 0.8
                const spacingBefore = block.level === 1 ? 1.5 : (block.level === 2 ? 1.2 : 0.8);
                const spacingAfter = block.level === 1 ? 1.5 : (block.level === 2 ? 1.2 : 0.8);
                
                doc.moveDown(spacingBefore)
                   .font(koreanFontBold)
                   .fontSize(fontSize);
                
                // h1은 가운데 정렬, 나머지는 왼쪽 정렬
                const textAlign = block.level === 1 ? 'center' : 'left';
                this.renderTextWithBoldAndEmoji(doc, block.text, koreanFont, koreanFontBold, emojiFont, textAlign);
                
                doc.font(koreanFont)
                   .fontSize(12)
                   .moveDown(spacingAfter);
            }
            else if (block.type === 'paragraph') {
                // "핵심 성과:" 같은 강조 문구는 작은 제목처럼 처리
                const isSubHeading = block.text.match(/^(\*\*)?[가-힣\s]+:(\*\*)?$/);
                if (isSubHeading) {
                    lastWasSubHeading = true;
                    doc.moveDown(0.6);
                    doc.font(koreanFontBold);
                    doc.fontSize(14); // h3보다 작지만 일반 텍스트보다 큼
                    
                    this.renderTextWithBoldAndEmoji(doc, block.text, koreanFont, koreanFontBold, emojiFont);
                    
                    doc.font(koreanFont)
                       .fontSize(12)
                       .moveDown(0.6);
                } else {
                    lastWasSubHeading = false;
                    
                    // h3 이상의 heading이거나 sub-heading 다음에 오는 paragraph만 들여쓰기
                    // h1, h2 다음에는 들여쓰기 안 함
                    const needsIndent = (lastHeadingLevel >= 3) || lastWasSubHeading;
                    
                    doc.moveDown(1.0);
                    doc.font(koreanFont);
                    doc.fontSize(12);
                    
                    if (needsIndent) {
                        // 들여쓰기 적용 (약 20pt)
                        const indentText = '    '; // 약 20pt 정도의 공백
                        doc.text(indentText, { continued: true });
                    }
                    
                    // 링크 처리: 마크다운 링크 [텍스트](URL) 파싱
                    this.renderParagraphWithLinks(doc, block.text, koreanFont, koreanFontBold, emojiFont);
                    
                    doc.text('', { continued: false });
                    doc.moveDown(1.0);
                }
            }
            else if (block.type === 'list') {
                // h3 이상의 heading이거나 sub-heading 다음에 오는 리스트만 추가 들여쓰기
                // h1, h2 다음에는 기본 들여쓰기만
                const baseIndent = '   '; // 기본 들여쓰기
                const extraIndent = ((lastHeadingLevel >= 3) || lastWasSubHeading) ? '    ' : ''; // 추가 들여쓰기
                const totalIndent = extraIndent + baseIndent;
                
                doc.moveDown(0.6);
                doc.font(koreanFont);
                doc.fontSize(12);
                
                block.items.forEach((item, index) => {
                    // 마커
                    let marker = '';
                    if (block.ordered) {
                        marker = `${item.number}. `;
                    } else {
                        marker = '• ';
                    }
                    
                    doc.text(totalIndent + marker, { continued: true });
                    
                    // 항목 내용
                    this.renderTextWithBoldAndEmoji(doc, item.text, koreanFont, koreanFontBold, emojiFont);
                    
                    doc.text('', { continued: false });
                    doc.moveDown(1.0);
                });
                
                doc.moveDown(0.6);
            }
            else if (block.type === 'table') {
                // 표 렌더링
                doc.moveDown(0.6);
                
                if (!block.rows || block.rows.length === 0) {
                    doc.moveDown(0.6);
                    return;
                }
                
                // 표 크기 계산
                const pageWidth = doc.page.width;
                const pageMargins = doc.page.margins;
                const tableWidth = pageWidth - pageMargins.left - pageMargins.right;
                const columnCount = block.rows[0] ? block.rows[0].length : 2;
                const columnWidth = tableWidth / columnCount;
                const cellPadding = 8;
                const rowHeight = 20;
                
                // 첫 번째 행을 헤더로 간주
                const headerRow = block.rows[0];
                const dataRows = block.rows.slice(1);
                
                // 헤더 렌더링 함수
                const renderHeader = (y) => {
                    doc.font(koreanFontBold)
                       .fontSize(11)
                       .fillColor('#333333');
                    
                    let currentX = pageMargins.left;
                    headerRow.forEach((cell, index) => {
                        const cellText = cell || '';
                        doc.text(cellText, currentX + cellPadding, y, {
                            width: columnWidth - cellPadding * 2,
                            height: rowHeight,
                            align: 'left'
                        });
                        currentX += columnWidth;
                    });
                    
                    // 헤더 밑줄
                    const headerBottomY = y + rowHeight;
                    doc.moveTo(pageMargins.left, headerBottomY)
                       .lineTo(pageMargins.left + tableWidth, headerBottomY)
                       .lineWidth(1)
                       .strokeColor('#cccccc')
                       .stroke();
                    
                    return headerBottomY;
                };
                
                // 행 렌더링 함수 (링크 포함)
                const renderRow = (row, rowY) => {
                    let currentX = pageMargins.left;
                    row.forEach((cell, colIndex) => {
                        const cellText = cell || '';
                        const cellX = currentX + cellPadding;
                        const cellY = rowY + 5;
                        
                        // 셀 내부 링크 처리
                        const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
                        let processedText = cellText;
                        const links = [];
                        let match;
                        
                        // 링크 찾기
                        while ((match = linkPattern.exec(cellText)) !== null) {
                            links.push({
                                text: match[1],
                                url: match[2],
                                index: match.index,
                                length: match[0].length
                            });
                        }
                        
                        // 좌표 저장
                        const savedX = doc.x;
                        const savedY = doc.y;
                        
                        // 셀 위치로 이동
                        doc.x = cellX;
                        doc.y = cellY;
                        
                        // 링크가 있으면 링크 처리, 없으면 일반 처리
                        if (links.length > 0) {
                            let lastIndex = 0;
                            links.forEach(link => {
                                // 링크 이전 텍스트
                                if (link.index > lastIndex) {
                                    const beforeText = processedText.substring(lastIndex, link.index);
                                    const boldParts = this.processBold(beforeText);
                                    boldParts.forEach(part => {
                                        const font = part.type === 'bold' ? koreanFontBold : koreanFont;
                                        doc.font(font);
                                        doc.text(part.text, {
                                            width: columnWidth - cellPadding * 2,
                                            align: 'left',
                                            continued: true
                                        });
                                    });
                                }
                                
                                // 링크 텍스트 렌더링
                                const linkStartX = doc.x;
                                const linkStartY = doc.y;
                                doc.fillColor('#0066cc');
                                const linkBoldParts = this.processBold(link.text);
                                linkBoldParts.forEach(part => {
                                    const font = part.type === 'bold' ? koreanFontBold : koreanFont;
                                    doc.font(font);
                                    doc.text(part.text, {
                                        width: columnWidth - cellPadding * 2,
                                        align: 'left',
                                        continued: true
                                    });
                                });
                                const linkWidth = doc.x - linkStartX;
                                const linkHeight = savedFontSize || 10;
                                doc.link(linkStartX, linkStartY, linkWidth, linkHeight, link.url);
                                doc.fillColor('#000000');
                                
                                lastIndex = link.index + link.length;
                            });
                            
                            // 링크 이후 텍스트
                            if (lastIndex < processedText.length) {
                                const afterText = processedText.substring(lastIndex);
                                const boldParts = this.processBold(afterText);
                                boldParts.forEach(part => {
                                    const font = part.type === 'bold' ? koreanFontBold : koreanFont;
                                    doc.font(font);
                                    doc.text(part.text, {
                                        width: columnWidth - cellPadding * 2,
                                        align: 'left',
                                        continued: true
                                    });
                                });
                            }
                        } else {
                            // 링크 없으면 일반 볼드 처리
                            const boldParts = this.processBold(cellText);
                            boldParts.forEach((part, partIndex) => {
                                const font = part.type === 'bold' ? koreanFontBold : koreanFont;
                                doc.font(font);
                                const isContinued = partIndex < boldParts.length - 1;
                                doc.text(part.text, {
                                    width: columnWidth - cellPadding * 2,
                                    align: 'left',
                                    continued: isContinued
                                });
                            });
                        }
                        
                        // 위치 복원
                        doc.x = savedX;
                        doc.y = savedY;
                        
                        currentX += columnWidth;
                    });
                };
                
                let currentY = doc.y;
                let tableStartY = currentY;
                const savedFontSize = 10; // 셀 내부 기본 폰트 크기
                
                // 첫 헤더 렌더링
                currentY = renderHeader(currentY);
                
                // 데이터 행 렌더링 (페이지 넘김 처리)
                doc.font(koreanFont)
                   .fontSize(10)
                   .fillColor('#000000');
                
                let currentPageStartY = tableStartY;
                let rowsOnCurrentPage = 0;
                const maxRowsPerPage = Math.floor((doc.page.height - doc.page.margins.bottom - currentY) / rowHeight);
                
                dataRows.forEach((row, rowIndex) => {
                    // 현재 행이 페이지를 넘어가는지 체크
                    if (rowsOnCurrentPage >= maxRowsPerPage || 
                        (currentY + rowHeight > doc.page.height - doc.page.margins.bottom && rowIndex > 0)) {
                        // 현재 페이지의 표 종료
                        const currentPageEndY = currentY;
                        
                        // 현재 페이지 표 외곽선
                        doc.rect(pageMargins.left, currentPageStartY, tableWidth, currentPageEndY - currentPageStartY)
                           .lineWidth(1)
                           .strokeColor('#cccccc')
                           .stroke();
                        
                        // 세로 구분선
                        for (let i = 1; i < columnCount; i++) {
                            const lineX = pageMargins.left + (i * columnWidth);
                            doc.moveTo(lineX, currentPageStartY)
                               .lineTo(lineX, currentPageEndY)
                               .lineWidth(0.5)
                               .strokeColor('#e0e0e0')
                               .stroke();
                        }
                        
                        // 새 페이지 추가
                        doc.addPage();
                        currentY = doc.page.margins.top;
                        currentPageStartY = currentY;
                        rowsOnCurrentPage = 0;
                        
                        // 새 페이지에 헤더 다시 렌더링
                        currentY = renderHeader(currentY);
                        doc.font(koreanFont).fontSize(10);
                    }
                    
                    // 행 렌더링
                    renderRow(row, currentY);
                    currentY += rowHeight;
                    rowsOnCurrentPage++;
                    
                    // 행 구분선
                    if (rowIndex < dataRows.length - 1) {
                        doc.moveTo(pageMargins.left, currentY)
                           .lineTo(pageMargins.left + tableWidth, currentY)
                           .lineWidth(0.5)
                           .strokeColor('#e0e0e0')
                           .stroke();
                    }
                });
                
                // 마지막 페이지의 표 종료
                const finalTableEndY = currentY;
                doc.rect(pageMargins.left, currentPageStartY, tableWidth, finalTableEndY - currentPageStartY)
                   .lineWidth(1)
                   .strokeColor('#cccccc')
                   .stroke();
                
                // 세로 구분선
                for (let i = 1; i < columnCount; i++) {
                    const lineX = pageMargins.left + (i * columnWidth);
                    doc.moveTo(lineX, currentPageStartY)
                       .lineTo(lineX, finalTableEndY)
                       .lineWidth(0.5)
                       .strokeColor('#e0e0e0')
                       .stroke();
                }
                
                // 표 종료 후 위치 명확히 설정
                doc.y = finalTableEndY + 15;
                doc.x = pageMargins.left;
                doc.fontSize(12);
                
                doc.moveDown(0.6);
            }
        });
    }

    /**
     * 이모지 감지 함수
     * @param {string} text - 텍스트
     * @returns {boolean} 이모지 포함 여부
     */
    hasEmoji(text) {
        // 이모지 유니코드 범위 체크
        const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]|[\u{FE00}-\u{FE0F}]|[\u{200D}]/gu;
        return emojiRegex.test(text);
    }

    /**
     * 텍스트를 이모지와 일반 텍스트로 분리
     * @param {string} text - 텍스트
     * @returns {Array} 분리된 텍스트 부분 배열
     */
    splitByEmoji(text) {
        const parts = [];
        const emojiRegex = /([\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]|[\u{FE00}-\u{FE0F}]|[\u{200D}]+)/gu;
        let lastIndex = 0;
        let match;
        
        while ((match = emojiRegex.exec(text)) !== null) {
            if (match.index > lastIndex) {
                parts.push({ type: 'text', text: text.substring(lastIndex, match.index) });
            }
            parts.push({ type: 'emoji', text: match[0] });
            lastIndex = match.index + match[0].length;
        }
        
        if (lastIndex < text.length) {
            parts.push({ type: 'text', text: text.substring(lastIndex) });
        }
        
        return parts.length > 0 ? parts : [{ type: 'text', text: text }];
    }

    /**
     * 볼드 처리된 텍스트 렌더링 (이모지 지원)
     * @param {PDFDocument} doc - PDF 문서 객체
     * @param {string} text - 텍스트
     * @param {string} koreanFont - 한글 폰트 이름
     * @param {string} koreanFontBold - 한글 볼드 폰트 이름
     * @param {string} emojiFont - 이모지 폰트 이름 (null 가능)
     */
    renderTextWithBoldAndEmoji(doc, text, koreanFont, koreanFontBold, emojiFont = null, align = 'left', options = {}) {
        // 1. 볼드 패턴으로 분리
        const boldParts = this.processBold(text);
        
        // 2. 각 부분을 이모지와 텍스트로 분리하여 렌더링
        let isFirstPart = true;
        boldParts.forEach(boldPart => {
            const currentFont = boldPart.type === 'bold' ? koreanFontBold : koreanFont;
            
            if (emojiFont && this.hasEmoji(boldPart.text)) {
                // 이모지가 있는 경우 분리하여 렌더링
                const emojiParts = this.splitByEmoji(boldPart.text);
                emojiParts.forEach(emojiPart => {
                    if (emojiPart.type === 'emoji' && emojiFont) {
                        try {
                            doc.font(emojiFont);
                        } catch (error) {
                            // 이모지 폰트 실패 시 기본 폰트 사용
                            doc.font(currentFont);
                        }
                    } else {
                        doc.font(currentFont);
                    }
                    // 첫 번째 부분에만 align 옵션 적용
                    if (isFirstPart) {
                        doc.text(emojiPart.text, { continued: true, align: align });
                        isFirstPart = false;
                    } else {
                        doc.text(emojiPart.text, { continued: true });
                    }
                });
            } else {
                // 이모지가 없는 경우 일반 렌더링
                doc.font(currentFont);
                // 첫 번째 부분에만 align 옵션 적용
                if (isFirstPart) {
                    doc.text(boldPart.text, { continued: true, align: align });
                    isFirstPart = false;
                } else {
                    doc.text(boldPart.text, { continued: true });
                }
            }
        });
        
        // continued 상태 명시적 종료 (다음 블록이 새 줄 첫 열에서 시작하도록)
        doc.text('', { continued: false });
    }

    /**
     * 볼드 처리된 텍스트 렌더링 (이전 버전 - 호환성 유지)
     * @param {PDFDocument} doc - PDF 문서 객체
     * @param {string} text - 텍스트
     * @param {string} koreanFont - 한글 폰트 이름
     * @param {string} koreanFontBold - 한글 볼드 폰트 이름
     */
    renderTextWithBold(doc, text, koreanFont, koreanFontBold) {
        this.renderTextWithBoldAndEmoji(doc, text, koreanFont, koreanFontBold, null);
    }

    /**
     * 링크가 포함된 paragraph 렌더링
     * @param {PDFDocument} doc - PDF 문서 객체
     * @param {string} text - 텍스트
     * @param {string} koreanFont - 한글 폰트 이름
     * @param {string} koreanFontBold - 한글 볼드 폰트 이름
     * @param {string} emojiFont - 이모지 폰트 이름
     */
    renderParagraphWithLinks(doc, text, koreanFont, koreanFontBold, emojiFont = null) {
        // 마크다운 링크 패턴: [텍스트](URL)
        const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
        let lastIndex = 0;
        let match;
        let hasLinks = false;
        
        // 링크 파싱 및 렌더링
        while ((match = linkPattern.exec(text)) !== null) {
            hasLinks = true;
            
            // 링크 이전 텍스트
            if (match.index > lastIndex) {
                const beforeText = text.substring(lastIndex, match.index);
                // 볼드 처리된 텍스트를 링크 없이 렌더링
                const boldParts = this.processBold(beforeText);
                boldParts.forEach(part => {
                    const font = part.type === 'bold' ? koreanFontBold : koreanFont;
                    doc.font(font);
                    doc.text(part.text, { continued: true });
                });
            }
            
            // 링크 텍스트와 URL
            const linkText = match[1];
            const linkUrl = match[2];
            
            // 링크 텍스트 렌더링 전 위치 저장
            const startX = doc.x;
            const startY = doc.y;
            const savedFontSize = doc._fontSize || 12;
            
            // 링크 텍스트 렌더링 (파란색)
            doc.fillColor('#0066cc'); // 파란색
            const boldParts = this.processBold(linkText);
            
            // 전체 링크 텍스트의 너비 계산
            let totalLinkWidth = 0;
            boldParts.forEach(part => {
                const font = part.type === 'bold' ? koreanFontBold : koreanFont;
                doc.font(font);
                doc.fontSize(savedFontSize);
                totalLinkWidth += doc.widthOfString(part.text);
            });
            
            // 링크 텍스트 렌더링
            boldParts.forEach(part => {
                const font = part.type === 'bold' ? koreanFontBold : koreanFont;
                doc.font(font);
                doc.fontSize(savedFontSize);
                doc.text(part.text, { continued: true });
            });
            
            // 링크 영역 계산 (렌더링 후 위치)
            const endY = doc.y;
            const linkHeight = Math.max(savedFontSize, Math.abs(endY - startY) + 2); // 텍스트 높이 + 여유 공간
            
            // 링크 URL 추가 (pdfkit의 link 기능)
            // pdfkit의 link는 페이지 상단 기준 좌표계를 사용합니다 (y는 위에서 아래로)
            // startY는 현재 커서 위치이므로 직접 사용 가능
            doc.link(startX, startY, totalLinkWidth, linkHeight, linkUrl);
            
            // 색상 복원
            doc.fillColor('#000000');
            
            lastIndex = match.index + match[0].length;
        }
        
        // 링크 이후 텍스트
        if (lastIndex < text.length) {
            const afterText = text.substring(lastIndex);
            const boldParts = this.processBold(afterText);
            boldParts.forEach(part => {
                const font = part.type === 'bold' ? koreanFontBold : koreanFont;
                doc.font(font);
                doc.text(part.text, { continued: true });
            });
        }
        
        // 링크가 없는 경우 일반 렌더링
        if (!hasLinks) {
            this.renderTextWithBoldAndEmoji(doc, text, koreanFont, koreanFontBold, emojiFont);
        }
    }

    /**
     * 볼드 패턴 처리
     * @param {string} text - 텍스트
     * @returns {Array} 파싱된 텍스트 부분 배열
     */
    processBold(text) {
        const parts = [];
        let lastIndex = 0;
        const regex = /\*\*([^*]+)\*\*/g;
        let match;
        
        while ((match = regex.exec(text)) !== null) {
            if (match.index > lastIndex) {
                parts.push({ type: 'normal', text: text.substring(lastIndex, match.index) });
            }
            parts.push({ type: 'bold', text: match[1] });
            lastIndex = match.index + match[0].length;
        }
        
        if (lastIndex < text.length) {
            parts.push({ type: 'normal', text: text.substring(lastIndex) });
        }
        
        return parts.length > 0 ? parts : [{ type: 'normal', text: text }];
    }

    /**
     * 마크다운 파싱
     * @param {string} markdown - 마크다운 텍스트
     * @returns {Array} 파싱된 블록 배열
     */
    parseMarkdown(markdown) {
        const lines = markdown.split('\n');
        const blocks = [];
        let currentBlock = null;
        
        lines.forEach((line) => {
            const trimmed = line.trim();
            
            // 제목 처리 (h1-h6) - 이모지 제거 및 텍스트만 추출
            const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
            if (headingMatch) {
                if (currentBlock) blocks.push(currentBlock);
                const level = headingMatch[1].length;
                // 이모지 유지 (원본 텍스트 그대로 사용)
                let headingText = headingMatch[2].trim();
                
                currentBlock = {
                    type: 'heading',
                    level: level,
                    text: headingText
                };
                return;
            }
            
            // 순서 없는 리스트
            const ulMatch = trimmed.match(/^[-*]\s+(.+)$/);
            if (ulMatch) {
                if (currentBlock && currentBlock.type !== 'list') {
                    blocks.push(currentBlock);
                }
                if (!currentBlock || currentBlock.type !== 'list' || currentBlock.ordered) {
                    if (currentBlock && currentBlock.type === 'list') {
                        blocks.push(currentBlock);
                    }
                    currentBlock = {
                        type: 'list',
                        ordered: false,
                        items: []
                    };
                }
                currentBlock.items.push({ text: ulMatch[1] });
                return;
            }
            
            // 순서 있는 리스트
            const olMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
            if (olMatch) {
                if (currentBlock && currentBlock.type !== 'list' && currentBlock.type !== 'table') {
                    blocks.push(currentBlock);
                }
                if (currentBlock && currentBlock.type === 'table') {
                    blocks.push(currentBlock);
                }
                if (!currentBlock || currentBlock.type !== 'list' || !currentBlock.ordered) {
                    if (currentBlock && currentBlock.type === 'list') {
                        blocks.push(currentBlock);
                    }
                    currentBlock = {
                        type: 'list',
                        ordered: true,
                        items: []
                    };
                }
                // 원문의 넘버를 그대로 사용 (자동 카운팅 하지 않음)
                const itemNumber = parseInt(olMatch[1], 10);
                currentBlock.items.push({ text: olMatch[2], number: itemNumber });
                return;
            }
            
            // 표 처리 (|로 시작하고 끝나는 줄)
            if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
                // 구분선 제거: 셀 내용이 모두 하이픈, 콜론, 공백만 포함하는지 확인
                const cells = trimmed.split('|').slice(1, -1).map(cell => cell.trim());
                // 구분선 체크: 모든 셀이 하이픈, 콜론, 공백만 포함하거나 빈 문자열인 경우
                const isSeparator = cells.length > 0 && cells.every(cell => {
                    // 각 셀이 하이픈(-), 콜론(:), 공백만 포함하거나 완전히 비어있는지 확인
                    // 예: "------", "---", ":", " ", "" 등
                    return cell === '' || /^[\s\-:]+$/.test(cell);
                });
                
                if (isSeparator) {
                    // 구분선은 완전히 무시
                    return;
                }
                
                // 표 블록 시작 또는 기존 표에 행 추가
                if (!currentBlock || currentBlock.type !== 'table') {
                    if (currentBlock) blocks.push(currentBlock);
                    currentBlock = {
                        type: 'table',
                        rows: []
                    };
                }
                
                // 셀 분리
                currentBlock.rows.push(cells);
                return;
            }
            
            // 빈 줄 처리
            if (!trimmed) {
                // heading은 빈 줄과 관계없이 유지
                if (currentBlock && currentBlock.type === 'list') {
                    blocks.push(currentBlock);
                    currentBlock = null;
                } else if (currentBlock && currentBlock.type === 'paragraph') {
                    blocks.push(currentBlock);
                    currentBlock = null;
                } else if (currentBlock && currentBlock.type === 'table') {
                    // 표 종료
                    blocks.push(currentBlock);
                    currentBlock = null;
                }
                // heading은 유지 (빈 줄에서도 저장하지 않음)
                return;
            }
            
            // 일반 단락
            if (currentBlock && currentBlock.type === 'list') {
                blocks.push(currentBlock);
                currentBlock = {
                    type: 'paragraph',
                    text: trimmed
                };
            } else if (currentBlock && currentBlock.type === 'table') {
                // 표 다음에 다른 내용이 오면 표 종료
                blocks.push(currentBlock);
                currentBlock = {
                    type: 'paragraph',
                    text: trimmed
                };
            } else if (currentBlock && currentBlock.type === 'paragraph') {
                currentBlock.text += ' ' + trimmed;
            } else if (!currentBlock || currentBlock.type === 'heading') {
                // heading 다음에 오는 텍스트는 새 paragraph로 시작
                if (currentBlock && currentBlock.type === 'heading') {
                    blocks.push(currentBlock);
                }
                currentBlock = {
                    type: 'paragraph',
                    text: trimmed
                };
            }
        });
        
        if (currentBlock) {
            blocks.push(currentBlock);
        }
        
        return blocks;
    }

    /**
     * 마크다운을 HTML로 변환 (미리보기용)
     * @param {string} markdown - 마크다운 텍스트
     * @returns {string} HTML 텍스트
     */
    convertToHTML(markdown) {
        try {
            // 1. 마크다운 전처리
            const preprocessed = this.preprocessMarkdown(markdown);
            
            // 2. HTML 변환
            const html = this.md.render(preprocessed);
            
            // 3. HTML 후처리
            const postprocessed = this.postprocessHTML(html);
            
            return postprocessed;
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

