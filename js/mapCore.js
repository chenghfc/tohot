// 地图核心功能模块
let currentCoordinates = "";
let map = null;
let currentMarker = null;
let landLevels = [];
let districts = [];
var localSearch;
var currentMarkers = [];

function initMap() {
    // 初始化地图容器（无底图）
    map = new T.Map("map-container");
    const changzhouCenter = new T.LngLat(119.978, 31.789);
    map.centerAndZoom(changzhouCenter, 12);
    map.enableScrollWheelZoom(true);
    
    // 移除加载提示
    document.querySelector('.loading').style.display = 'none';

    // 绘制行政区划边界
    districts.forEach(district => {
        if (district.points.length === 0) return;
        const path = district.points.map(pt => new T.LngLat(pt[0], pt[1]));
        const polygon = new T.Polygon(path, {
            color: "#000000", weight: 3, opacity: 1,
            fillColor: district.color || "#ffffff", fillOpacity: 0
        });
        map.addOverLay(polygon);

        polygon.addEventListener("click", function(e) {
            handleMapClick(e);
        });
    });

    // 绘制土地等级边界
    landLevels.forEach(level => {
        if (level.points.length === 0) return;
        const path = level.points.map(pt => new T.LngLat(pt[0], pt[1]));
        const polygon = new T.Polygon(path, {
            color: "#333", weight: 1, opacity: 0,
            fillColor: level.color, fillOpacity: 0.4
        });
        map.addOverLay(polygon);

        polygon.addEventListener("click", function(e) {
            handleMapClick(e, level);
        });
    });

    // 地图空白区域点击事件
    map.addEventListener("click", function(e) {
        handleMapClick(e);
    });

    // 初始化搜索功能
    initSearch();
    // 绑定搜索事件
    bindEvents();
}

function handleMapClick(e, specificLevel = null) {
    const clickPoint = [e.lnglat.getLng(), e.lnglat.getLat()];
    currentCoordinates = `${clickPoint[0].toFixed(6)},${clickPoint[1].toFixed(6)}`;
    
    // 自动复制坐标
    autoCopyCoordinates();
    
    let foundLevel = "未匹配到具体土地等级";
    let foundPrice = "无";
    
    if (specificLevel) {
        foundLevel = specificLevel.name;
        foundPrice = specificLevel.price;
    } else {
        for (let level of landLevels) {
            if (level.points.length === 0) continue;
            const polygonPath = level.points.map(pt => new T.LngLat(pt[0], pt[1]));
            if (isPointInPolygon(e.lnglat, polygonPath)) {
                foundLevel = level.name;
                foundPrice = level.price;
                break;
            }
        }
    }
    
    showInfo(foundLevel, foundPrice, e.lnglat);
}

// 点是否在多边形内的判断方法
function isPointInPolygon(point, polygonPath) {
    let x = point.getLng(), y = point.getLat();
    let inside = false;
    for (let i = 0, j = polygonPath.length - 1; i < polygonPath.length; j = i++) {
        let xi = polygonPath[i].getLng(), yi = polygonPath[i].getLat();
        let xj = polygonPath[j].getLng(), yj = polygonPath[j].getLat();
        
        let intersect = ((yi > y) != (yj > y))
            && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

// 显示信息
function showInfo(levelName, price, lnglat) {
    const infoPanel = document.getElementById("info-panel");
    infoPanel.innerHTML = `
        <strong>位置坐标</strong>：经度 ${lnglat.getLng().toFixed(6)}，纬度 ${lnglat.getLat().toFixed(6)}<br>
        <strong>土地等级</strong>：${levelName}<br>
        <strong>税额标准</strong>：${price}
    `;
    infoPanel.innerHTML += '<button class="copy-btn" id="copyBtn" style="display: inline-block; margin-top: 10px;" onclick="copyCoordinates()">复制当前坐标</button>';

    if (currentMarker) {
        map.removeOverLay(currentMarker);
    }
    currentMarker = new T.Marker(new T.LngLat(lnglat.getLng(), lnglat.getLat()));
    map.addOverLay(currentMarker);

    const infoWindow = new T.InfoWindow(`
        <p>等级：${levelName}</p>
        <p>税额：${price}</p>
    `, { offset: new T.Point(0, -30) });
    infoWindow.open(map, new T.LngLat(lnglat.getLng(), lnglat.getLat()));
}

// 手动复制坐标功能
function copyCoordinates() {
    if (!currentCoordinates) {
        alert("暂无坐标可复制！");
        return;
    }
    copyToClipboard(currentCoordinates);
}

// 自动复制坐标功能
function autoCopyCoordinates() {
    if (!currentCoordinates) return;
    copyToClipboard(currentCoordinates);
}

// 通用复制到剪贴板方法
function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(() => {
            showCopyToast();
        }).catch(err => {
            fallbackCopyTextToClipboard(text);
        });
    } else {
        fallbackCopyTextToClipboard(text);
    }
}

// 复制降级方案
function fallbackCopyTextToClipboard(text) {
    const tempInput = document.createElement("input");
    tempInput.value = text;
    document.body.appendChild(tempInput);
    tempInput.select();
    try {
        document.execCommand("copy");
        showCopyToast();
    } catch (err) {
        console.error('复制失败:', err);
        alert("坐标复制失败，请手动复制！");
    }
    document.body.removeChild(tempInput);
}

// 显示复制成功提示
function showCopyToast() {
    const toast = document.getElementById("copyToast");
    toast.style.opacity = 0;
    clearTimeout(toast.timer);
    setTimeout(() => {
        toast.style.opacity = 1;
    }, 10);
    toast.timer = setTimeout(() => {
        toast.style.opacity = 0;
    }, 2000);
}

// 初始化搜索功能
function initSearch() {
    // 创建本地搜索对象
    var config = {
        pageCapacity: 10,  // 每页显示10条结果
        onSearchComplete: handleSearchResult  // 搜索完成回调
    };
    localSearch = new T.LocalSearch(map, config);
}

// 绑定事件
function bindEvents() {
    // 搜索按钮点击事件
    const searchBtn = document.getElementById('searchBtn');
    const searchInput = document.getElementById('searchInput');
    
    if (searchBtn && searchInput) {
        searchBtn.addEventListener('click', function() {
            var keyword = searchInput.value.trim();
            if (keyword) {
                searchLocation(keyword);
            }
        });
        
        // 搜索输入框回车事件
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                var keyword = searchInput.value.trim();
                if (keyword) {
                    searchLocation(keyword);
                }
            }
        });
    }
    
    // 分页按钮事件
    const firstPageBtn = document.getElementById('firstPage');
    const prevPageBtn = document.getElementById('prevPage');
    const nextPageBtn = document.getElementById('nextPage');
    const lastPageBtn = document.getElementById('lastPage');
    
    if (firstPageBtn) firstPageBtn.addEventListener('click', function() {
        localSearch.firstPage();
    });
    if (prevPageBtn) prevPageBtn.addEventListener('click', function() {
        localSearch.previousPage();
    });
    if (nextPageBtn) nextPageBtn.addEventListener('click', function() {
        localSearch.nextPage();
    });
    if (lastPageBtn) lastPageBtn.addEventListener('click', function() {
        localSearch.lastPage();
    });
}

// 执行搜索
function searchLocation(keyword) {
    // 清除之前的搜索结果
    clearSearchResults();
    
    // 执行搜索
    localSearch.search(keyword);
}

// 处理搜索结果
function handleSearchResult(result) {
    // 清除之前的标记
    clearMarkers();
    
    // 显示搜索结果面板
    var resultsPanel = document.getElementById('searchResults');
    if (resultsPanel) {
        resultsPanel.style.display = 'block';
    }
    
    // 获取结果列表容器
    var resultsList = document.getElementById('resultsList');
    if (!resultsList) return;
    
    resultsList.innerHTML = '';
    
    // 检查结果类型
    var resultType = parseInt(result.getResultType());
    
    if (resultType === 1) { // POI点数据
        var pois = result.getPois();
        if (pois && pois.length > 0) {
            // 显示结果列表
            for (var i = 0; i < pois.length; i++) {
                (function(i) {
                    var poi = pois[i];
                    var name = poi.name;
                    var address = poi.address;
                    var lnglatArr = poi.lonlat.split(",");
                    var lnglat = new T.LngLat(parseFloat(lnglatArr[0]), parseFloat(lnglatArr[1]));
                    
                    // 创建标记
                    var marker = new T.Marker(lnglat);
                    map.addOverLay(marker);
                    currentMarkers.push(marker);
                    
                    // 创建信息窗口
                    var infoWin = new T.InfoWindow(
                        "<div style='padding:10px;'><strong>" + name + "</strong><br/>" + address + "</div>", 
                        {autoPan: true}
                    );
                    
                    // 标记点击事件
                    marker.addEventListener("click", function() {
                        marker.openInfoWindow(infoWin);
                    });
                    
                    // 创建结果项
                    var resultItem = document.createElement('div');
                    resultItem.className = 'result-item';
                    resultItem.innerHTML = 
                        '<div class="result-name">' + (i+1) + '. ' + name + '</div>' +
                        '<div class="result-address">' + address + '</div>';
                    
                    // 结果项点击事件
                    resultItem.addEventListener('click', function() {
                        // 定位到该点
                        map.panTo(lnglat);
                        // 打开信息窗口
                        marker.openInfoWindow(infoWin);
                        // 清除搜索结果面板
                        clearSearchResults();
                    });
                    
                    resultsList.appendChild(resultItem);
                })(i);
            }
            
            // 更新分页信息
            updatePaginationInfo(result);
            
            // 调整地图视图以包含所有标记
            if (pois.length > 0) {
                var bounds = new T.LngLatBounds();
                for (var i = 0; i < pois.length; i++) {
                    var lnglatArr = pois[i].lonlat.split(",");
                    bounds.extend(new T.LngLat(parseFloat(lnglatArr[0]), parseFloat(lnglatArr[1])));
                }
                map.setViewport(bounds.getBounds());
            }
        } else {
            resultsList.innerHTML = '<div class="result-item">未找到相关结果</div>';
            var pagination = document.getElementById('pagination');
            if (pagination) pagination.style.display = 'none';
        }
    } else {
        resultsList.innerHTML = '<div class="result-item">未找到相关结果</div>';
        var pagination = document.getElementById('pagination');
        if (pagination) pagination.style.display = 'none';
    }
}

// 更新分页信息
function updatePaginationInfo(result) {
    var totalCount = localSearch.getCountNumber();
    var totalPages = localSearch.getCountPage();
    var currentPage = localSearch.getPageIndex();
    
    var pageInfo = document.getElementById('pageInfo');
    if (pageInfo) {
        pageInfo.textContent = '第' + currentPage + '页/共' + totalPages + '页 (' + totalCount + '条结果)';
    }
    
    // 显示分页控件
    var pagination = document.getElementById('pagination');
    if (pagination) pagination.style.display = 'flex';
}

// 清除搜索结果
function clearSearchResults() {
    var resultsPanel = document.getElementById('searchResults');
    if (resultsPanel) resultsPanel.style.display = 'none';
    
    var resultsList = document.getElementById('resultsList');
    if (resultsList) resultsList.innerHTML = '';
    
    clearMarkers();
}

// 清除地图上的标记
function clearMarkers() {
    for (var i = 0; i < currentMarkers.length; i++) {
        map.removeOverLay(currentMarkers[i]);
    }
    currentMarkers = [];
}

// 页面加载完成后初始化
window.onload = function() {
    // 确保所有依赖数据加载完成后再初始化地图
    if (typeof districts !== 'undefined' && typeof landLevels !== 'undefined') {
        initMap();
    } else {
        // 如果数据未加载，等待一段时间再重试
        setTimeout(function() {
            if (typeof districts !== 'undefined' && typeof landLevels !== 'undefined') {
                initMap();
            }
        }, 100);
    }
};