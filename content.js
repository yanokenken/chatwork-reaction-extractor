window.addEventListener('load', load, false);
window.onpopstate = load;

wait(500).then(() => {
	const scrollDiv = document.getElementById('_timeLine').firstElementChild;
	scrollDiv.addEventListener('scroll', async function() {

		const scrollPosition = scrollDiv.scrollTop || document.documentElement.scrollTop;
		const windowHeight = window.innerHeight;
		// scrollイベントの抑制
		if (scrollPosition % 10 !== 0) {
			return;
		}
		console.log('scrollPosition: ' + scrollPosition);
		console.log('windowHeight: ' + windowHeight);

		// if (/scrollPosition < windowHeight) {
			console.log('reload');
			await wait(500);
			load();
		// }
	}, false);
});

let RETRY_INITIALIZE_COUNT = 0;
let isLoading = false;
/**
 * ロード処理
 * リアクションチェックボタンの制御
 */
async function load() {	
	if (isLoading) {
		return;
	}
	isLoading = true;
	console.log('load');
	// 既にボタンがある場合削除
	const buttons = document.querySelectorAll('.reaction-button');
	for (const button of buttons) {
		console.log('remove button')
		button.remove();
	}


  const reactionButtons = document.querySelectorAll('[aria-label="リアクションを確認する"]');
	
	if(!reactionButtons || reactionButtons.length === 0) {
		if (RETRY_INITIALIZE_COUNT < 10) {
			RETRY_INITIALIZE_COUNT++;
			console.log('reaction buttons 再取得');
			await load();
			return;
		}else if (RETRY_INITIALIZE_COUNT === 10) {
			alert('マイチャットや個人間チャットでは動作しません。グループチャットで実行してください。');
			return;
		}
	}
	RETRY_INITIALIZE_COUNT = 0;
  for (const reactionButton of reactionButtons) {
    const newButton = document.createElement('button');
    newButton.textContent = 'リアクションチェック';
		newButton.classList.add('reaction-button','px-8','py-1','ms-2','font-semibold','border','rounded','dark:bg-gray-100','dark:text-gray-800');
    newButton.addEventListener('click', function() {
			reactionCount(this)
		});
    const parentElement = reactionButton.parentElement;
    parentElement.parentNode.insertBefore(newButton, parentElement.nextSibling);		
  };
	isLoading = false;
}

/**
 * リアクションの数をカウントして表示する
 * @param {*} elm 押されたリアクションチェックボタン
 */
async function reactionCount(elm) {
	const reactionUsers = await getReactionUsers(elm);
	const allUsers = await getAllUsers();

	// リアクションありなしの表を作成
	// userName | imgurl_1 | imgurl_2 | imgurl_3 | ...
	// user1    | ◯        | ✕        | ✕        | ...

	// リアクションありなしの表を作成
	let reactionTable = [];
	// 1行目
	const NAME_LABEL = '氏名';
	let headerRow = [NAME_LABEL];
	for (const reactionUser of reactionUsers) {
		headerRow.push(reactionUser[0]);
	}
	reactionTable.push(headerRow);
	// 2行目以降
	if (!allUsers || !reactionUsers) {
		alert('エラーが発生しました。グループチャットで実行してください。');
		return;
	}
	for (const user of allUsers) {
		let reactionRow = [user];
		for (const reactionUser of reactionUsers) {
			let marubatsu = reactionUser.includes(user) ? '◯' : '✕';
			reactionRow.push(marubatsu);
		}
		reactionTable.push(reactionRow);
	}

	// htmlを作成してモーダル表示
	let table = '<table id="result_table" class="m-auto">';
	let isMidashi = true;
	for (const row of reactionTable) {
		table += '<tr>';
		for (const cell of row) {
			// 1行目は見出し
			if (isMidashi && cell !== NAME_LABEL) {
				let imgHtml = document.createElement('img');
				imgHtml.src = cell;
				imgHtml.width = 15;
				imgHtml.height = 15;
				table += '<th class="px-2" style="border:1px solid gray">' + imgHtml.outerHTML + '</th>';
			}else{
				table += '<td class="text-center px-2" style="border:1px solid gray">' + cell + '</td>';
			}
		}
		table += '</tr>';
		isMidashi = false;
	}
	table += '</table>';

	const modal = document.createElement('div');
	modal.innerHTML = table + 
	`
	<div class="flex flex-col justify-center gap-3 mt-6 sm:flex-row">
		<button id='close' class="px-6 py-2 rounded-sm border bg-gray-300">閉じる</button>
		<button id='copy' class="px-6 py-2 rounded-sm shadow-sm dark:bg-blue-800 dark:text-gray-100">コピー</button>
	</div>
	`
	;
	modal.classList.add(
    'transform','translate-x-[-50%]','translate-y-[-50%]'
    ,'w-80','h-[80%]','overflow-scroll', 'm-auto', 'p-6'
    ,'rounded-md','shadow-lg', 'z-[1000]', 'bg-white'
    ,'fixed','top-1/2','left-1/2'
);
	modal.id = 'modal';
	document.body.appendChild(modal);

	const closeButton = document.getElementById('close');
	closeButton.addEventListener('click', function() {
		modal.remove();
	});
	const copyButton = document.getElementById('copy');
	copyButton.addEventListener('click', function() {
			const table = document.getElementById('result_table');
			copyTableToClipboard(table);

	});
}

/**
 *　リアクションを押したユーザーを取得する
 * @param {*} elm 押されたリアクションチェックボタン
 * @returns リアクションユーザー名の配列
 */
async function getReactionUsers(elm) {
	const siblingDivs = elm.previousElementSibling;
  const buttons = siblingDivs.querySelectorAll('button');
  buttons.forEach(button => {
    button.click();
  });
	await wait(300);

	const reactionTabButtons = document.getElementsByClassName('_reactionTabButton');
	let userNames = [];
  for (const reactionTabButton of reactionTabButtons) {
    reactionTabButton.click();		
    await wait(300);
		// reactionTabButtonsの中のimg要素のsrcを取得
		const imgUrl = reactionTabButton.querySelector('img').src;
    const userElements = document.querySelectorAll('.reactionUserListTooltip__userName');
		let namesWithImg = [imgUrl].concat(
				Array.from(userElements, userElement => userElement.textContent.trim().replace('さん', '')));
  userNames.push(namesWithImg);
  }
	return userNames;
}

let RETRY_GETALLUSER_COUNT = 0;
/**
 * チャットグループの参加者を取得する
 * @returns チャットグループ参加者の名前の配列
 */
async function getAllUsers() {
	const button = document.getElementById('_memberDetailButton');
	if (button) {
		button.click();
		// 開かれたダイアログを閉じる
		setTimeout(() => {
			const closeButton = document.querySelector('[aria-label="閉じる"]');			
			closeButton.click();
		}, 500);

	} else {
		if (RETRY_GETALLUSER_COUNT < 10) {
			RETRY_GETALLUSER_COUNT++;
			console.log('get all users再取得');
			await getAllUsers();
			return;
		}else if (RETRY_GETALLUSER_COUNT === 10) {
			alert('マイチャットや個人間チャットでは動作しません。グループチャットで実行してください。');
			return false;
		}
	}
	RETRY_GETALLUSER_COUNT = 0;

	let allUsers = [];
	const userElements = document.querySelectorAll('.roomMemberTable__nameText');
	for (const userElement of userElements) {
		// userElementの中のspan要素のtextを取得
		const userName = userElement.querySelector('span').textContent.trim();
		allUsers.push(userName);
	}
	return allUsers;
	


}

/**
 * 一覧結果の表をクリップボードにコピーする
 * @param {*} table 
 */
function copyTableToClipboard(table) {
	let text = '';
	for (let r = 0; r < table.rows.length; r++) {
			for (let c = 0; c < table.rows[r].cells.length; c++) {
					text += table.rows[r].cells[c].innerText;
					if (c < table.rows[r].cells.length - 1) {
							text += '\t';
					}
			}
			text += '\n';
	}
	navigator.clipboard.writeText(text).then(function() {
			alert('クリップボードにコピーしました');
			let modal = document.getElementById('modal');
			modal.remove();
	}, function(err) {
			console.error('Could not copy text: ', err);
			alert('コピーに失敗しました');
	});
}

/**
 * 指定ミリ秒待機する
 * @param {*} ms 
 * @returns 
 */
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));	
}